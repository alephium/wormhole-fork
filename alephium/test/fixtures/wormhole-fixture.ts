import Web3  from 'web3'
import { randomBytes } from 'crypto'
import * as base58 from 'bs58'
import { nonce, toHex, zeroPad } from '../../lib/utils'
import * as elliptic from 'elliptic'
import { CliqueClient, Contract, ContractState } from 'alephium-web3'

export const web3 = new Web3()
export const ethAccounts = web3.eth.accounts
export const web3Utils = web3.utils

export const alphChainId = 13
export const dustAmount = BigInt("1000000000000")
export const oneAlph = BigInt("1000000000000000000")
export const u256Max = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff")

export class ContractInfo {
    contract: Contract
    selfState: ContractState
    dependencies: ContractState[]
    address: string

    states(): ContractState[] {
        return [this.selfState].concat(this.dependencies)
    }

    constructor(contract: Contract, selfState: ContractState, dependencies: ContractState[], address: string) {
        this.contract = contract
        this.selfState = selfState 
        this.dependencies = dependencies
        this.address = address
    }
}

export async function createSerde(client: CliqueClient): Promise<ContractInfo> {
    const serdeContract = await Contract.from(client, 'serde.ral')
    const address = randomContractAddress()
    const contractState = serdeContract.toState(
        [], {alphAmount: dustAmount}, address
    )
    return new ContractInfo(serdeContract, contractState, [], address)
}

export async function createMath(client: CliqueClient): Promise<ContractInfo> {
    const mathContract = await Contract.from(client, 'math.ral')
    const address = randomContractAddress()
    const contractState = mathContract.toState(
        [], {alphAmount: dustAmount}, address
    )
    return new ContractInfo(mathContract, contractState, [], address)
}

export class GuardianSet {
    privateKeys: string[]
    index: number

    constructor(keys: string[], index: number) {
        this.privateKeys = keys
        this.index = index
    }

    static random(size: number, index: number): GuardianSet {
        const pks = Array(size).fill(0).map(_ => ethAccounts.create().privateKey)
        return new GuardianSet(pks, index)
    }

    addresses(): string[] {
        return this.privateKeys.map(key => ethAccounts.privateKeyToAccount(key).address)
    }

    guardianSetAddresses(size: number): string[] {
        return this.addresses().map(addr => addr.slice(2)).concat(Array(size - this.size()).fill('00'))
    }

    size(): number {
        return this.privateKeys.length
    }

    quorumSize(): number {
        return (this.size() * 10 / 3) * 2 / 10 + 1
    }

    sign(size: number, body: VAABody): VAA {
        const keys = this.privateKeys
            .map((_, index) => [Math.random(), index])
            .sort((a, b) => a[0] - b[0])
            .slice(0, size)
            .sort((a, b) => a[1] - b[1])
        const hash = web3Utils.keccak256(web3Utils.keccak256('0x' + toHex(body.encode())))
        const signatures = keys.map(element => {
            const keyIndex = element[1]
            const ec = new elliptic.ec('secp256k1')
            const key = ec.keyFromPrivate(this.privateKeys[keyIndex].slice(2))
            const sig = key.sign(hash.slice(2), {canonical: true})
            const signature = [
                zeroPad(sig.r.toString(16), 32),
                zeroPad(sig.s.toString(16), 32),
                zeroPad((sig.recoveryParam as number + 27).toString(16), 1)
            ].join("")
            const buffer = Buffer.allocUnsafe(66)
            buffer.writeUint8(keyIndex, 0)
            buffer.write(signature, 1, 'hex')
            return buffer
        })
        return new VAA(1, this.index, signatures, body)
    }
}

export class VAABody {
    timestamp: number   // seconds
    nonce: string
    emitterChainId: number
    emitterAddress: string 
    sequence: number
    consistencyLevel: number
    payload: Uint8Array

    constructor(
        payload: Uint8Array,
        emitterChainId: number,
        emitterAddress: string,
        sequence: number,
        timestamp: number = 0,
        nonceHex: string = nonce(),
        consistencyLevel = 0
    ) {
        this.timestamp = timestamp
        this.nonce = nonceHex
        this.emitterChainId = emitterChainId
        this.emitterAddress = emitterAddress
        this.sequence = sequence
        this.consistencyLevel = consistencyLevel
        this.payload = payload
    }

    encode(): Uint8Array {
        let header = Buffer.allocUnsafe(51)
        header.writeUint32BE(this.timestamp, 0)
        header.write(this.nonce, 4, 'hex')
        header.writeUint16BE(this.emitterChainId, 8)
        header.write(this.emitterAddress, 10, 'hex')
        header.writeBigUInt64BE(BigInt(this.sequence), 42)
        header.writeUint8(this.consistencyLevel, 50)
        return Buffer.concat([header, this.payload])
    }
}

export class VAA {
    version: number
    guardianSetIndex: number
    signatures: Uint8Array[]
    body: VAABody

    constructor(version: number, guardianSetIndex: number, signatures: Uint8Array[], body: VAABody) {
        this.version = version
        this.guardianSetIndex = guardianSetIndex
        this.signatures = signatures
        this.body = body
    }

    encode(): Uint8Array {
        const signatureSize = this.signatures.length
        let header = Buffer.allocUnsafe(6)
        header.writeUint8(this.version, 0)
        header.writeUint32BE(this.guardianSetIndex, 1)
        header.writeUint8(signatureSize, 5)
        return Buffer.concat([
            header,
            Buffer.concat(this.signatures),
            this.body.encode()
        ])
    }
}

export function randomAssetAddress(): string {
    const prefix = Buffer.from([0x00])
    const bytes = Buffer.concat([prefix, randomBytes(32)])
    return base58.encode(bytes)
}

export function toRecipientId(address: string): string {
    const bytes = base58.decode(address)
    return toHex(bytes.slice(1))
}

export function randomContractAddress(): string {
    const prefix = Buffer.from([0x03])
    const bytes = Buffer.concat([prefix, randomBytes(32)])
    return base58.encode(bytes)
}

interface Failed {
    error: {
        detail: string
    }
}

async function expectFailed<T>(func: () => Promise<T>, details: string[]) {
    try {
        await func()
    } catch (exp) {
        const detail = (exp as Failed).error.detail
        expect(details).toContain(detail)
    }
}

export async function expectAssertionFailed<T>(func: () => Promise<T>) {
    await expectFailed(func, ['AssertionFailed'])
}

export async function expectAssertionFailedOrRecoverEthAddressFailed<T>(func: () => Promise<T>) {
    await expectFailed(func, ['AssertionFailed', 'FailedInRecoverEthAddress'])
}

export function toContractId(address: string): string {
    const bytes = base58.decode(address)
    return toHex(bytes.slice(1))
}

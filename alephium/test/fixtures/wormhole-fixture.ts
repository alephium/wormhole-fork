import Web3 from 'web3'
import { randomBytes } from 'crypto'
import * as base58 from 'bs58'
import { nonce, zeroPad } from '../../lib/utils'
import * as elliptic from 'elliptic'
import { Contract, ContractState, Asset, contractIdFromAddress, binToHex, Project, NodeProvider } from '@alephium/web3'

export const web3 = new Web3()
export const ethAccounts = web3.eth.accounts
export const web3Utils = web3.utils

export const CHAIN_ID_ALEPHIUM = 255
export const dustAmount = BigInt('1000000000000000')
export const oneAlph = BigInt('1000000000000000000')
export const minimalAlphInContract = oneAlph
export const initAsset: Asset = {
  alphAmount: minimalAlphInContract
}
export const u256Max = 1n << 255n
export const gasPrice = BigInt('100000000000')
export const maxGasPerTx = BigInt('625000')
export const defaultGasFee = gasPrice * maxGasPerTx

export async function buildProject(): Promise<void> {
  if (typeof Project.currentProject === 'undefined') {
    await Project.build({ ignoreUnusedConstantsWarnings: true })
  }
}

export class ContractInfo {
  contract: Contract
  selfState: ContractState
  dependencies: ContractState[]
  address: string
  contractId: string
  bytecode: string
  codeHash: string

  states(): ContractState[] {
    return [this.selfState].concat(this.dependencies)
  }

  constructor(contract: Contract, selfState: ContractState, dependencies: ContractState[], address: string) {
    this.contract = contract
    this.selfState = selfState
    this.dependencies = dependencies
    this.address = address
    this.contractId = selfState.contractId
    this.bytecode = selfState.bytecode
    this.codeHash = selfState.codeHash
  }
}

export function createMath(): ContractInfo {
  const mathContract = Project.contract('MathTest')
  const address = randomContractAddress()
  const contractState = mathContract.toState({}, { alphAmount: minimalAlphInContract }, address)
  return new ContractInfo(mathContract, contractState, [], address)
}

export class GuardianSet {
  privateKeys: string[]
  index: number
  addresses: string[]

  constructor(keys: string[], index: number, addresses: string[]) {
    this.privateKeys = keys
    this.index = index
    this.addresses = addresses
  }

  static random(size: number, index: number): GuardianSet {
    const pks = Array(size)
      .fill(0)
      .map((_) => ethAccounts.create().privateKey)
    const addresses = pks.map((key) => ethAccounts.privateKeyToAccount(key).address.slice(2)) // drop the 0x prefix
    return new GuardianSet(pks, index, addresses)
  }

  encodeAddresses(): string {
    const sizeHex = zeroPad(this.addresses.length.toString(16), 1)
    return sizeHex + this.addresses.join('')
  }

  size(): number {
    return this.privateKeys.length
  }

  quorumSize(): number {
    return Math.floor((Math.floor((this.size() * 10) / 3) * 2) / 10) + 1
  }

  sign(size: number, body: VAABody): VAA {
    const keys = this.privateKeys
      .map((_, index) => [Math.random(), index])
      .sort((a, b) => a[0] - b[0])
      .slice(0, size)
      .sort((a, b) => a[1] - b[1])
    const hash = web3Utils.keccak256(web3Utils.keccak256('0x' + binToHex(body.encode())))
    const signatures = keys.map((element) => {
      const keyIndex = element[1]
      const ec = new elliptic.ec('secp256k1')
      const key = ec.keyFromPrivate(this.privateKeys[keyIndex].slice(2))
      const sig = key.sign(hash.slice(2), { canonical: true })
      const signature = [
        zeroPad(sig.r.toString(16), 32),
        zeroPad(sig.s.toString(16), 32),
        zeroPad((sig.recoveryParam as number).toString(16), 1)
      ].join('')
      const buffer = Buffer.allocUnsafe(66)
      buffer.writeUint8(keyIndex, 0)
      buffer.write(signature, 1, 'hex')
      return buffer
    })
    return new VAA(1, this.index, signatures, body)
  }
}

export class VAABody {
  timestamp: number // seconds
  nonce: string
  emitterChainId: number
  targetChainId: number
  emitterAddress: string
  sequence: number
  consistencyLevel: number
  payload: Uint8Array

  constructor(
    payload: Uint8Array,
    emitterChainId: number,
    targetChainId: number,
    emitterAddress: string,
    sequence: number,
    timestamp = 0,
    nonceHex: string = nonce(),
    consistencyLevel = 0
  ) {
    this.timestamp = timestamp
    this.nonce = nonceHex
    this.emitterChainId = emitterChainId
    this.targetChainId = targetChainId
    this.emitterAddress = emitterAddress
    this.sequence = sequence
    this.consistencyLevel = consistencyLevel
    this.payload = payload
  }

  encode(): Uint8Array {
    const header = Buffer.allocUnsafe(53)
    header.writeUint32BE(this.timestamp, 0)
    header.write(this.nonce, 4, 'hex')
    header.writeUint16BE(this.emitterChainId, 8)
    header.writeUint16BE(this.targetChainId, 10)
    header.write(this.emitterAddress, 12, 'hex')
    header.writeBigUInt64BE(BigInt(this.sequence), 44)
    header.writeUint8(this.consistencyLevel, 52)
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
    const header = Buffer.allocUnsafe(6)
    header.writeUint8(this.version, 0)
    header.writeUint32BE(this.guardianSetIndex, 1)
    header.writeUint8(signatureSize, 5)
    return Buffer.concat([header, Buffer.concat(this.signatures), this.body.encode()])
  }
}

export class ContractUpgrade {
  contractCode: string
  prevStateHash?: string
  state?: string

  constructor(contractCode: string, prevStateHash?: string, state?: string) {
    this.contractCode = contractCode
    this.prevStateHash = prevStateHash
    this.state = state
  }

  encode(module: string, action: number) {
    const contractCodeLength = this.contractCode.length / 2
    const buffer0 = Buffer.allocUnsafe(32 + 1 + 2 + contractCodeLength)
    buffer0.write(module, 0, 'hex')
    buffer0.writeUint8(action, 32)
    buffer0.writeUint16BE(contractCodeLength, 33)
    buffer0.write(this.contractCode, 35, 'hex')
    if (this.state !== undefined) {
      const stateLength = this.state.length / 2
      const buffer1 = Buffer.allocUnsafe(32 + 2 + stateLength)
      buffer1.write(this.prevStateHash as string, 0, 'hex')
      buffer1.writeUint16BE(stateLength, 32)
      buffer1.write(this.state, 34, 'hex')
      return Buffer.concat([buffer0, buffer1])
    }
    return buffer0
  }
}

export function randomAssetAddress(): string {
  const prefix = Buffer.from([0x00])
  const bytes = Buffer.concat([prefix, randomBytes(32)])
  return base58.encode(bytes)
}

export function toRecipientId(address: string): string {
  const bytes = base58.decode(address)
  return binToHex(bytes.slice(1))
}

export function randomContractId(): string {
  return binToHex(contractIdFromAddress(randomContractAddress()))
}

export function randomContractAddress(): string {
  const prefix = Buffer.from([0x03])
  const bytes = Buffer.concat([prefix, randomBytes(32)])
  return base58.encode(bytes)
}

export function alph(n: number): bigint {
  return oneAlph * BigInt(n)
}

export function encodeU256(value: bigint): Uint8Array {
  return Buffer.from(zeroPad(value.toString(16), 32), 'hex')
}

async function expectFailed<T>(func: () => Promise<T>, details: string[]) {
  try {
    await func()
  } catch (err) {
    const message = (err as Error).message
    expect(details.some((e) => message.indexOf(e) !== -1)).toEqual(true)
  }
}

export async function expectAssertionFailed<T>(func: () => Promise<T>) {
  await expectFailed(func, ['AssertionFailed', 'AssertionFailedWithErrorCode'])
}

export async function expectNotEnoughBalance<T>(func: () => Promise<T>) {
  await expectFailed(func, ['NotEnoughBalance'])
}

export async function expectOneOfError<T>(func: () => Promise<T>, errors: string[]) {
  await expectFailed(func, errors)
}

export async function expectError<T>(func: () => Promise<T>, error: string) {
  await expectFailed(func, [error])
}

export function chainIdToBytes(chainId: number): Uint8Array {
  return Buffer.from(zeroPad(chainId.toString(16), 2), 'hex')
}

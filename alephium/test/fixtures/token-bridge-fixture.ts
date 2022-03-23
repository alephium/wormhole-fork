import { CliqueClient, Contract } from 'alephium-js'
import { createGovernance, governanceChainId, governanceContractAddress } from './governance-fixture'
import { alphChainId, ContractInfo, createSequence, createSerde, dustAmount, randomContractAddress, toContractId } from './wormhole-fixture'
import { randomBytes } from 'crypto'
import { toHex } from '../../lib/utils'

const tokenBridgeModule = '000000000000000000000000000000000000000000546f6b656e427269646765'

export class AttestToken {
    tokenId: string
    symbol: string
    name: string
    decimals: number

    constructor(tokenId: string, symbol: string, name: string, decimals: number) {
        this.tokenId = tokenId
        this.symbol = symbol
        this.name = name
        this.decimals = decimals
    }

    encode(): Uint8Array {
        let buffer = Buffer.allocUnsafe(100)
        buffer.writeUint8(2, 0) // payloadId
        buffer.write(this.tokenId, 1, 'hex')
        buffer.writeUInt16BE(alphChainId, 33)
        buffer.writeUint8(this.decimals, 35)
        buffer.write(this.symbol, 36, 'hex')
        buffer.write(this.name, 68, 'hex')
        return buffer
    }
}

export class RegisterChain {
    targetChainId: number
    remoteChainId: number
    remoteTokenBridgeId: string

    constructor(targetChainId: number, remoteChainId: number, remoteTokenBridgeId: string) {
        this.targetChainId = targetChainId
        this.remoteChainId = remoteChainId
        this.remoteTokenBridgeId = remoteTokenBridgeId
    }

    encode(): Uint8Array {
        let buffer = Buffer.allocUnsafe(69)
        buffer.write(tokenBridgeModule, 0, 'hex')
        buffer.writeUint8(1, 32) // actionId
        buffer.writeUint16BE(this.targetChainId, 33)
        buffer.writeUint16BE(this.remoteChainId, 35)
        buffer.write(this.remoteTokenBridgeId, 37, 'hex')
        return buffer
    }
}

export async function getTokenWrapperContract(client: CliqueClient): Promise<Contract> {
    return await Contract.from(client, 'token_wrapper.ral', {
        sequenceCodeHash: '00',
        serdeAddress: '00',
        tokenBridgeForChainBinCode: '00',
        tokenBridgeForChainCodeHash: '00',
        tokenWrapperCodeHash: '00',
        tokenWrapperFactoryAddress: '00',
        tokenWrapperBinCode: '00'
    })
}

export async function createTestToken(client: CliqueClient): Promise<ContractInfo> {
    const token = await Contract.from(client, 'token.ral')
    const address = randomContractAddress()
    const tokenSupply = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const initFields = [
        toHex(randomBytes(32)), // symbol
        toHex(randomBytes(32)), // name
        8, // decimals
        tokenSupply // supply
    ]
    const state = token.toState(
        initFields, {alphAmount: dustAmount}, address
    )
    return new ContractInfo(token, state, [], address)
}

export async function createTokenWrapperFactory(
    client: CliqueClient,
    serdeInfo: ContractInfo,
    tokenWrapperContract: Contract
): Promise<ContractInfo> {
    const contract = await Contract.from(client, 'token_wrapper_factory.ral', {
        serdeAddress: serdeInfo.address,
        tokenWrapperBinCode: tokenWrapperContract.bytecode
    })
    const address = randomContractAddress()
    const state = contract.toState(
        [], {alphAmount: dustAmount}, address
    )
    return new ContractInfo(contract, state, [], address)
}

export async function getTokenBridgeForChainContract(
    client: CliqueClient,
    sequenceCodeHash: string,
    tokenWrapperFactoryAddress: string,
    tokenWrapperCodeHash: string
): Promise<Contract> {
    return await Contract.from(client, 'token_bridge_for_chain.ral', {
        sequenceCodeHash: sequenceCodeHash,
        tokenWrapperFactoryAddress: tokenWrapperFactoryAddress,
        tokenWrapperCodeHash: tokenWrapperCodeHash,
        tokenWrapperBinCode: '00',
        serdeAddress: '00',
        tokenBridgeForChainBinCode: '00',
        tokenBridgeForChainCodeHash: '00',
    })
}

export async function createTokenBridge(client: CliqueClient): Promise<ContractInfo> {
    const serde = await createSerde(client)
    const governance = await createGovernance(client)
    const tokenWrapper = await getTokenWrapperContract(client)
    const tokenWrapperFactory = await createTokenWrapperFactory(client, serde, tokenWrapper)
    const tokenBridgeAddress = randomContractAddress()
    const sequence = await createSequence(client, tokenBridgeAddress)
    const tokenBridgeForChainContract = await getTokenBridgeForChainContract(
        client,
        sequence.contract.codeHash,
        tokenWrapperFactory.address,
        tokenWrapper.codeHash,
    )
    const tokenBridge = await Contract.from(client, 'token_bridge.ral', {
        sequenceCodeHash: sequence.contract.codeHash,
        serdeAddress: serde.address,
        tokenBridgeForChainBinCode: tokenBridgeForChainContract.bytecode,
        tokenBridgeForChainCodeHash: tokenBridgeForChainContract.codeHash,
        tokenWrapperCodeHash: tokenWrapper.codeHash
    })
    const state = tokenBridge.toState(
        [governance.address, governanceChainId, governanceContractAddress, true, sequence.address, alphChainId, 0],
        {alphAmount: dustAmount},
        tokenBridgeAddress
    )
    const deps = Array.prototype.concat(
        serde.states(),
        governance.states(),
        sequence.states(),
        tokenWrapperFactory.states()
    )
    return new ContractInfo(tokenBridge, state, deps, tokenBridgeAddress)
}

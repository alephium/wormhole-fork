import { NodeProvider, Contract, ContractState, subContractId } from '@alephium/web3'
import { createGovernance, governanceChainId } from './governance-fixture'
import { CHAIN_ID_ALEPHIUM, ContractInfo, minimalAlphInContract, initAsset, randomContractAddress, randomContractId, randomAssetAddress, toContractAddress } from './wormhole-fixture'
import { zeroPad } from '../../lib/utils'
import { createUndoneSequence } from './sequence-fixture'

export const tokenBridgeModule = '000000000000000000000000000000000000000000546f6b656e427269646765'

export class AttestToken {
    tokenId: string
    tokenChainId: number
    symbol: string
    name: string
    decimals: number

    constructor(tokenId: string, tokenChainId: number, symbol: string, name: string, decimals: number) {
        this.tokenId = tokenId
        this.tokenChainId = tokenChainId
        this.symbol = symbol
        this.name = name
        this.decimals = decimals
    }

    encode(): Uint8Array {
        let buffer = Buffer.allocUnsafe(100)
        buffer.writeUint8(2, 0) // payloadId
        buffer.write(this.tokenId, 1, 'hex')
        buffer.writeUInt16BE(this.tokenChainId, 33)
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

export class DestroyUndoneSequenceContracts {
    remoteChainId: number
    paths: number[]

    constructor(remoteChainId: number, paths: number[]) {
        this.remoteChainId = remoteChainId
        this.paths = paths 
    }

    encode(): Uint8Array {
        const size = this.paths.length
        const buffer = Buffer.allocUnsafe(33 + 2 + 2 + 8 * size)
        buffer.write(tokenBridgeModule, 0, 'hex')
        buffer.writeUint8(240, 32) // actionId, #f0
        buffer.writeUint16BE(this.remoteChainId, 33)
        buffer.writeUint16BE(size, 35)
        let index = 37
        this.paths.forEach(path => {
            buffer.writeBigUint64BE(BigInt(path), index)
            index += 8
        })
        return buffer
    }
}

export class Transfer {
    amount: bigint
    tokenId: string
    tokenChainId: number
    recipient: string
    recipientChainId: number
    arbiterFee: bigint

    constructor(amount: bigint, tokenId: string, tokenChainId: number, recipient: string, recipientChainId: number, arbiterFee: bigint) {
        this.amount = amount
        this.tokenId = tokenId
        this.tokenChainId = tokenChainId
        this.recipient = recipient
        this.recipientChainId = recipientChainId 
        this.arbiterFee = arbiterFee
    }

    encode(): Uint8Array {
        let buffer = Buffer.allocUnsafe(133)
        buffer.writeUint8(1, 0) // payloadId
        buffer.write(zeroPad(this.amount.toString(16), 32), 1, 'hex')
        buffer.write(this.tokenId, 33, 'hex')
        buffer.writeUint16BE(this.tokenChainId, 65)
        buffer.write(this.recipient, 67, 'hex')
        buffer.writeUint16BE(this.recipientChainId, 99)
        buffer.write(zeroPad(this.arbiterFee.toString(16), 32), 101, 'hex')
        return buffer
    }
}

export async function getTokenWrapperContract(provider: NodeProvider): Promise<Contract> {
    return await Contract.fromSource(provider, 'token_wrapper.ral')
}

export async function createTestToken(
    provider: NodeProvider,
    decimals: number,
    symbol: string,
    name: string,
    supply?: bigint
): Promise<ContractInfo> {
    const token = await Contract.fromSource(provider, 'test_token.ral')
    const address = randomContractAddress()
    const initFields = {
        "symbol_": symbol,
        "name_": name,
        "decimals_": decimals,
        "totalSupply_": supply ? supply : BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    }
    const state = token.toState(initFields, {alphAmount: minimalAlphInContract}, address)
    return new ContractInfo(token, state, [], address)
}

export class TokenBridgeInfo extends ContractInfo {
    governance: ContractInfo

    tokenWrapperContract: Contract
    tokenWrapperCodeHash: string
    tokenBridgeForChainContract: Contract

    constructor(
        contract: Contract,
        selfState: ContractState,
        deps: ContractState[],
        address: string,
        governance: ContractInfo,
        tokenWrapperContract: Contract,
        tokenWrapperCodeHash: string,
        tokenBridgeForChainContract: Contract
    ) {
        super(contract, selfState, deps, address)
        this.governance = governance
        this.tokenWrapperContract = tokenWrapperContract
        this.tokenWrapperCodeHash = tokenWrapperCodeHash
        this.tokenBridgeForChainContract = tokenBridgeForChainContract
    }
}

export class TokenBridgeForChainInfo extends ContractInfo {
    remoteChainId: number

    constructor(
        contract: Contract,
        selfState: ContractState,
        deps: ContractState[],
        address: string,
        remoteChainId: number
    ) {
        super(contract, selfState, deps, address)
        this.remoteChainId = remoteChainId
    }
}

async function createTemplateTokenWrapper(provider: NodeProvider): Promise<ContractInfo> {
    const tokenWrapper = await Contract.fromSource(provider, 'token_wrapper.ral')
    const address = randomContractAddress()
    const initFields = {
        'tokenBridgeId': '',
        'tokenBridgeForChainId': '',
        'localChainId': 0,
        'remoteChainId': 0,
        'tokenContractId': '',
        'isLocalToken': true,
        'symbol_': '',
        'name_': '',
        'decimals_': 0
    }
    const state = tokenWrapper.toState(initFields, initAsset, address)
    return new ContractInfo(tokenWrapper, state, [], address)
}

async function createTemplateTokenBridgeForChain(provider: NodeProvider): Promise<ContractInfo> {
    const tokenBridgeForChain = await Contract.fromSource(provider, 'token_bridge_for_chain.ral')
    const address = randomContractAddress()
    const initFields = {
        'governanceContractId': '',
        'localChainId': 0,
        'localTokenBridgeId': '',
        'remoteChainId': 0,
        'remoteTokenBridgeId': '',
        'next': 0,
        'next1': 0,
        'next2': 0,
        'undoneSequenceTemplateId': '',
        'tokenWrapperTemplateId': '',
        'tokenWrapperCodeHash': '',
        'refundAddress': randomAssetAddress()
    }
    const state = tokenBridgeForChain.toState(initFields, initAsset, address)
    return new ContractInfo(tokenBridgeForChain, state, [], address)
}

export async function createTokenBridge(provider: NodeProvider, address?: string): Promise<TokenBridgeInfo> {
    const tokenBridge = await Contract.fromSource(provider, 'token_bridge.ral')
    const governance = await createGovernance(provider)
    const tokenWrapper = await createTemplateTokenWrapper(provider)
    const tokenBridgeForChain = await createTemplateTokenBridgeForChain(provider)

    const tokenBridgeAddress = typeof address === 'undefined' ? randomContractAddress() : address
    const undoneSequenceTemplate = await createUndoneSequence(
        provider, randomContractId(), 0, 0n, randomAssetAddress()
    )
    const initFields = {
        'governanceContractId': governance.contractId,
        'localChainId': CHAIN_ID_ALEPHIUM,
        'receivedSequence': 0,
        'sendSequence': 0,
        'tokenWrapperCodeHash': tokenWrapper.codeHash,
        'tokenWrapperTemplateId': tokenWrapper.contractId,
        'tokenBridgeForChainTemplateId': tokenBridgeForChain.contractId,
        'undoneSequenceTemplateId': undoneSequenceTemplate.contractId,
        'refundAddress': randomAssetAddress()
    }
    const state = tokenBridge.toState(initFields, initAsset, tokenBridgeAddress)
    const deps = Array.prototype.concat(
        governance.states(),
        tokenWrapper.states(),
        tokenBridgeForChain.states(),
        undoneSequenceTemplate.states()
    )
    return new TokenBridgeInfo(
        tokenBridge, state, deps, tokenBridgeAddress, governance,
        tokenWrapper.contract, tokenWrapper.codeHash, tokenBridgeForChain.contract
    )
}

function subContractAddress(parentId: string, pathHex: string): string {
    return toContractAddress(subContractId(parentId, pathHex))
}

export async function createTokenBridgeForChain(
    provider: NodeProvider,
    tokenBridge: TokenBridgeInfo,
    remoteChainId: number,
    remoteTokenBridgeId: string,
    address?: string
): Promise<TokenBridgeForChainInfo> {
    const contractAddress = typeof address === 'undefined' ?  subContractAddress(tokenBridge.contractId, zeroPad(remoteChainId.toString(16), 2)) : address
    const undoneSequenceTemplate = await createUndoneSequence(
        provider, randomContractId(), 0, 0n, randomAssetAddress()
    )
    const tokenWrapper = await createTemplateTokenWrapper(provider)
    const tokenBridgeForChainContract = await Contract.fromSource(provider, "token_bridge_for_chain.ral")
    const initFields = {
        'governanceContractId': tokenBridge.governance.contractId,
        'localChainId': CHAIN_ID_ALEPHIUM,
        'localTokenBridgeId': tokenBridge.contractId,
        'remoteChainId': remoteChainId,
        'remoteTokenBridgeId': remoteTokenBridgeId,
        'next': 0,
        'next1': 0,
        'next2': 0,
        'undoneSequenceTemplateId': undoneSequenceTemplate.contractId,
        'tokenWrapperTemplateId': tokenWrapper.contractId,
        'tokenWrapperCodeHash': tokenWrapper.codeHash,
        'refundAddress': randomAssetAddress()
    }
    const state = tokenBridgeForChainContract.toState(initFields, initAsset, contractAddress)
    const deps = Array.prototype.concat(
        tokenBridge.states(),
        tokenWrapper.states(),
        undoneSequenceTemplate.states()
    )
    return new TokenBridgeForChainInfo(tokenBridgeForChainContract, state, deps, contractAddress, remoteChainId)
}

export async function createWrapper(
    tokenId: string,
    isLocalToken: boolean,
    decimals: number,
    symbol: string,
    name: string,
    tokenBridgeInfo: TokenBridgeInfo,
    tokenBridgeForChainInfo: TokenBridgeForChainInfo,
    address?: string
): Promise<ContractInfo> {
    const tokenWrapperContract = tokenBridgeInfo.tokenWrapperContract
    const contractAddress = typeof address === 'undefined' ? subContractAddress(tokenBridgeForChainInfo.contractId, tokenId) : address
    const initFields = {
        'tokenBridgeId': tokenBridgeInfo.contractId,
        'tokenBridgeForChainId': tokenBridgeForChainInfo.contractId,
        'localChainId': CHAIN_ID_ALEPHIUM,
        'remoteChainId': tokenBridgeForChainInfo.remoteChainId,
        'tokenContractId': tokenId,
        'isLocalToken': isLocalToken,
        'symbol_': symbol,
        'name_': name,
        'decimals_': decimals
    }
    const state = tokenWrapperContract.toState(initFields, initAsset, contractAddress)
    return new ContractInfo(tokenWrapperContract, state, tokenBridgeForChainInfo.states(), contractAddress)
}

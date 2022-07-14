import { NodeProvider, Contract, ContractState, subContractId, Asset, stringToHex, addressFromContractId } from '@alephium/web3'
import { createGovernance } from './governance-fixture'
import { CHAIN_ID_ALEPHIUM, ContractInfo, minimalAlphInContract, initAsset, randomContractAddress, randomContractId, randomAssetAddress } from './wormhole-fixture'
import { zeroPad } from '../../lib/utils'
import { createUndoneSequence } from './sequence-fixture'

export const tokenBridgeModule = zeroPad(stringToHex('TokenBridge'), 32)

// Doc: https://github.com/certusone/wormhole/blob/dev.v2/whitepapers/0003_token_bridge.md
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
    remoteChainId: number
    remoteTokenBridgeId: string

    constructor(remoteChainId: number, remoteTokenBridgeId: string) {
        this.remoteChainId = remoteChainId
        this.remoteTokenBridgeId = remoteTokenBridgeId
    }

    encode(): Uint8Array {
        let buffer = Buffer.allocUnsafe(67)
        buffer.write(tokenBridgeModule, 0, 'hex')
        buffer.writeUint8(1, 32) // actionId
        buffer.writeUint16BE(this.remoteChainId, 33)
        buffer.write(this.remoteTokenBridgeId, 35, 'hex')
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
    arbiterFee: bigint

    constructor(amount: bigint, tokenId: string, tokenChainId: number, recipient: string, arbiterFee: bigint) {
        this.amount = amount
        this.tokenId = tokenId
        this.tokenChainId = tokenChainId
        this.recipient = recipient
        this.arbiterFee = arbiterFee
    }

    encode(): Uint8Array {
        let buffer = Buffer.allocUnsafe(131)
        buffer.writeUint8(1, 0) // payloadId
        buffer.write(zeroPad(this.amount.toString(16), 32), 1, 'hex')
        buffer.write(this.tokenId, 33, 'hex')
        buffer.writeUint16BE(this.tokenChainId, 65)
        buffer.write(this.recipient, 67, 'hex')
        buffer.write(zeroPad(this.arbiterFee.toString(16), 32), 99, 'hex')
        return buffer
    }
}

export async function getTokenWrapperContract(provider: NodeProvider): Promise<Contract> {
    return await Contract.fromSource(provider, 'token_bridge/token_wrapper.ral')
}

export async function createTestToken(provider: NodeProvider): Promise<ContractInfo> {
    const token = await Contract.fromSource(provider, 'tests/test_token.ral')
    const address = randomContractAddress()
    const state = token.toState({}, {alphAmount: minimalAlphInContract}, address)
    return new ContractInfo(token, state, [], address)
}

export class TokenBridgeInfo extends ContractInfo {
    governance: ContractInfo
    tokenWrapperContract: Contract

    constructor(
        contract: Contract,
        selfState: ContractState,
        deps: ContractState[],
        address: string,
        governance: ContractInfo,
        tokenWrapperContract: Contract
    ) {
        super(contract, selfState, deps, address)
        this.governance = governance
        this.tokenWrapperContract = tokenWrapperContract
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
    const tokenWrapper = await Contract.fromSource(provider, 'token_bridge/token_wrapper.ral')
    const address = randomContractAddress()
    const initFields = {
        'tokenBridgeId': '',
        'tokenBridgeForChainId': '',
        'localChainId': 0,
        'remoteChainId': 0,
        'bridgeTokenId': '',
        'isLocalToken': true,
        'symbol_': '',
        'name_': '',
        'decimals_': 0
    }
    const state = tokenWrapper.toState(initFields, initAsset, address)
    return new ContractInfo(tokenWrapper, state, [], address)
}

async function createTemplateAttestTokenHandler(provider: NodeProvider): Promise<ContractInfo> {
    const address = randomContractAddress()
    const initFields = {
        'governanceContractId': '',
        'localChainId': 0,
        'localTokenBridgeId': '',
        'remoteChainId': 0,
        'remoteTokenBridgeId': '',
        'receivedSequence': 0
    }
    const attestTokenHandler = await Contract.fromSource(provider, 'token_bridge/attest_token_handler.ral')
    const state = attestTokenHandler.toState(initFields, initAsset, address)
    return new ContractInfo(attestTokenHandler, state, [], address)
}

async function createTemplateTokenBridgeForChain(provider: NodeProvider): Promise<ContractInfo> {
    const tokenBridgeForChain = await Contract.fromSource(provider, 'token_bridge/token_bridge_for_chain.ral')
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
        'refundAddress': randomAssetAddress(),
        'sendSequence': 0
    }
    const state = tokenBridgeForChain.toState(initFields, initAsset, address)
    return new ContractInfo(tokenBridgeForChain, state, [], address)
}

export async function createTokenBridge(provider: NodeProvider, address?: string): Promise<TokenBridgeInfo> {
    const tokenBridge = await Contract.fromSource(provider, 'token_bridge/token_bridge.ral')
    const governance = await createGovernance(provider)
    const attestTokenHandler = await createTemplateAttestTokenHandler(provider)
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
        'tokenWrapperTemplateId': tokenWrapper.contractId,
        'tokenBridgeForChainTemplateId': tokenBridgeForChain.contractId,
        'attestTokenHandlerTemplateId': attestTokenHandler.contractId,
        'undoneSequenceTemplateId': undoneSequenceTemplate.contractId,
        'refundAddress': randomAssetAddress()
    }
    const state = tokenBridge.toState(initFields, initAsset, tokenBridgeAddress)
    const deps = Array.prototype.concat(
        governance.states(),
        attestTokenHandler.states(),
        tokenWrapper.states(),
        tokenBridgeForChain.states(),
        undoneSequenceTemplate.states()
    )
    return new TokenBridgeInfo(
        tokenBridge, state, deps, tokenBridgeAddress, governance, tokenWrapper.contract
    )
}

function subContractAddress(parentId: string, pathHex: string): string {
    return addressFromContractId(subContractId(parentId, pathHex))
}

export function attestTokenHandlerAddress(tokenBridgeId: string, remoteChainId: number): string {
    return subContractAddress(tokenBridgeId, '00' + zeroPad(remoteChainId.toString(16), 2))
}

export function tokenBridgeForChainAddress(tokenBridgeId: string, remoteChainId: number): string {
    return subContractAddress(tokenBridgeId, '01' + zeroPad(remoteChainId.toString(16), 2))
}

export async function createAttestTokenHandler(
    provider: NodeProvider,
    tokenBridge: TokenBridgeInfo,
    remoteChainId: number,
    remoteTokenBridgeId: string,
    address?: string
): Promise<ContractInfo> {
    const contractAddress = typeof address === 'undefined' ? attestTokenHandlerAddress(tokenBridge.contractId, remoteChainId) : address
    const attestTokenHandlerContract = await Contract.fromSource(provider, "token_bridge/attest_token_handler.ral")
    const initFields = {
        'governanceContractId': tokenBridge.governance.contractId,
        'localChainId': CHAIN_ID_ALEPHIUM,
        'localTokenBridgeId': tokenBridge.contractId,
        'remoteChainId': remoteChainId,
        'remoteTokenBridgeId': remoteTokenBridgeId,
        'receivedSequence': 0
    }
    const state = attestTokenHandlerContract.toState(initFields, initAsset, contractAddress)
    return new ContractInfo(attestTokenHandlerContract, state, tokenBridge.states(), contractAddress)
}

export async function createTokenBridgeForChain(
    provider: NodeProvider,
    tokenBridge: TokenBridgeInfo,
    remoteChainId: number,
    remoteTokenBridgeId: string,
    address?: string,
    initAlphAmount?: bigint
): Promise<TokenBridgeForChainInfo> {
    const contractAddress = typeof address === 'undefined' ? tokenBridgeForChainAddress(tokenBridge.contractId, remoteChainId) : address
    const undoneSequenceTemplate = await createUndoneSequence(
        provider, randomContractId(), 0, 0n, randomAssetAddress()
    )
    const tokenWrapper = await createTemplateTokenWrapper(provider)
    const tokenBridgeForChainContract = await Contract.fromSource(provider, "token_bridge/token_bridge_for_chain.ral")
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
        'refundAddress': randomAssetAddress(),
        'sendSequence': 0
    }
    const contractAsset: Asset = typeof initAlphAmount === 'undefined' ? initAsset : {alphAmount: initAlphAmount}
    const state = tokenBridgeForChainContract.toState(initFields, contractAsset, contractAddress)
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
        'bridgeTokenId': tokenId,
        'isLocalToken': isLocalToken,
        'symbol_': symbol,
        'name_': name,
        'decimals_': decimals
    }
    const state = tokenWrapperContract.toState(initFields, initAsset, contractAddress)
    return new ContractInfo(tokenWrapperContract, state, tokenBridgeForChainInfo.states(), contractAddress)
}

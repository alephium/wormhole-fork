import { NodeProvider, Contract, ContractState, subContractId, Asset, stringToHex, addressFromContractId, Fields, contractIdFromAddress, binToHex } from '@alephium/web3'
import { createGovernance } from './governance-fixture'
import { CHAIN_ID_ALEPHIUM, ContractInfo, minimalAlphInContract, initAsset, randomContractAddress, randomContractId, randomAssetAddress, oneAlph, alph } from './wormhole-fixture'
import { zeroPad } from '../../lib/utils'
import { createUndoneSequence } from './sequence-fixture'

export const tokenBridgeModule = zeroPad(stringToHex('TokenBridge'), 32)
export const minimalConsistencyLevel = 105

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

export class UpdateMinimalConsistencyLevel {
    minimalConsistencyLevel: number

    constructor(minimalConsistencyLevel: number) {
        this.minimalConsistencyLevel = minimalConsistencyLevel
    }

    encode(): Uint8Array {
        let buffer = Buffer.allocUnsafe(34)
        buffer.write(tokenBridgeModule, 0, 'hex')
        buffer.writeUint8(241, 32) // actionId, #f1
        buffer.writeUint8(this.minimalConsistencyLevel, 33)
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

export async function createTestToken(provider: NodeProvider): Promise<ContractInfo> {
    const token = await Contract.fromSource(provider, 'tests/test_token.ral')
    const address = randomContractAddress()
    const state = token.toState({}, {alphAmount: minimalAlphInContract}, address)
    return new ContractInfo(token, state, [], address)
}

export interface TemplateContracts {
    wrappedAlphPoolTemplate: ContractInfo
    localTokenPoolTemplate: ContractInfo
    remoteTokenPoolTemplate: ContractInfo
    undoneSequenceTemplate: ContractInfo
    tokenBridgeForChainTemplate: ContractInfo
    attestTokenHandlerTemplate: ContractInfo

    states(): ContractState[]
}

export class TokenBridgeInfo extends ContractInfo {
    governance: ContractInfo
    wrappedAlphId: string
    templateContracts: TemplateContracts

    constructor(
        contract: Contract,
        selfState: ContractState,
        deps: ContractState[],
        address: string,
        governance: ContractInfo,
        wrappedAlphId: string,
        templateContracts: TemplateContracts
    ) {
        super(contract, selfState, deps, address)
        this.governance = governance
        this.wrappedAlphId = wrappedAlphId
        this.templateContracts = templateContracts
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

async function createTemplateContracts(provider: NodeProvider): Promise<TemplateContracts> {
    const wrappedAlphPool = await createWrappedAlphPoolTemplate(provider)
    const localTokenPool = await createLocalTokenPoolTemplate(provider)
    const remoteTokenPool = await createRemoteTokenPoolTemplate(provider)
    const attestTokenHandler = await createAttestTokenHandlerTemplate(provider)
    const tokenBridgeForChain = await createTokenBridgeForChainTemplate(provider)
    const undoneSequence = await createUndoneSequence(provider, randomContractId(), 0, 0n, randomAssetAddress())
    return {
        wrappedAlphPoolTemplate: wrappedAlphPool,
        localTokenPoolTemplate: localTokenPool,
        remoteTokenPoolTemplate: remoteTokenPool,
        attestTokenHandlerTemplate: attestTokenHandler,
        tokenBridgeForChainTemplate: tokenBridgeForChain,
        undoneSequenceTemplate: undoneSequence,

        states(): ContractState[] {
            return [
                wrappedAlphPool.selfState,
                localTokenPool.selfState,
                remoteTokenPool.selfState,
                attestTokenHandler.selfState,
                tokenBridgeForChain.selfState,
                undoneSequence.selfState
            ]
        }
    }
}

async function createContract(
    provider: NodeProvider,
    path: string,
    initFields: Fields,
    deps: ContractState[] = [],
    asset: Asset = initAsset,
    address?: string,
): Promise<ContractInfo> {
    const contract = await Contract.fromSource(provider, path)
    const contractAddress = typeof address === 'undefined' ? randomContractAddress() : address
    const state = contract.toState(initFields, asset, address)
    return new ContractInfo(contract, state, deps, contractAddress)
}

async function createWrappedAlph(provider: NodeProvider, totalWrapped: bigint): Promise<ContractInfo> {
    const contractId = randomContractId()
    const initAsset: Asset = {
        alphAmount: totalWrapped,
        tokens: [{
            id: contractId,
            amount: totalWrapped
        }]
    }
    return createContract(provider, 'token_bridge/wrapped_alph.ral', {'totalWrapped': totalWrapped}, [], initAsset, addressFromContractId(contractId))
}

async function createWrappedAlphPoolTemplate(provider: NodeProvider): Promise<ContractInfo> {
    return createContract(provider, 'token_bridge/wrapped_alph_pool.ral', {
        'tokenBridgeId': '',
        'tokenChainId': 0,
        'bridgeTokenId': '',
        'totalBridged': 0,
        'decimals_': 0
    })
}

async function createLocalTokenPoolTemplate(provider: NodeProvider): Promise<ContractInfo> {
    return createContract(provider, 'token_bridge/local_token_pool.ral', {
        'tokenBridgeId': '',
        'tokenChainId': 0,
        'bridgeTokenId': '',
        'totalBridged': 0,
        'decimals_': 0
    })
}

async function createRemoteTokenPoolTemplate(provider: NodeProvider): Promise<ContractInfo> {
    return createContract(provider, 'token_bridge/remote_token_pool.ral', {
        'tokenBridgeId': '',
        'tokenChainId': 0,
        'bridgeTokenId': '',
        'totalBridged': 0,
        'symbol_': '',
        'name_': '',
        'decimals_': 0
    })
}

async function createAttestTokenHandlerTemplate(provider: NodeProvider): Promise<ContractInfo> {
    return createContract(provider, 'token_bridge/attest_token_handler.ral', {
        'governanceContractId': '',
        'localChainId': 0,
        'localTokenBridgeId': '',
        'remoteChainId': 0,
        'remoteTokenBridgeId': '',
        'receivedSequence': 0
    })
}

async function createTokenBridgeForChainTemplate(provider: NodeProvider): Promise<ContractInfo> {
    return createContract(provider, 'token_bridge/token_bridge_for_chain.ral', {
        'governanceContractId': '',
        'localChainId': 0,
        'localTokenBridgeId': '',
        'remoteChainId': 0,
        'remoteTokenBridgeId': '',
        'next': 0,
        'next1': 0,
        'next2': 0,
        'undoneSequenceTemplateId': '',
        'refundAddress': randomAssetAddress(),
        'sendSequence': 0
    })
}

export async function createTokenBridge(provider: NodeProvider, totalWrappedAlph: bigint = 0n, address?: string): Promise<TokenBridgeInfo> {
    const tokenBridge = await Contract.fromSource(provider, 'token_bridge/token_bridge.ral')
    const governance = await createGovernance(provider)
    const wrappedAlph = await createWrappedAlph(provider, totalWrappedAlph)
    const templateContracts = await createTemplateContracts(provider)
    const tokenBridgeAddress = typeof address === 'undefined' ? randomContractAddress() : address
    const initFields = {
        'governanceContractId': governance.contractId,
        'localChainId': CHAIN_ID_ALEPHIUM,
        'receivedSequence': 0,
        'sendSequence': 0,
        'wrappedAlphId': wrappedAlph.contractId,
        'wrappedAlphPoolTemplateId': templateContracts.wrappedAlphPoolTemplate.contractId,
        'localTokenPoolTemplateId': templateContracts.localTokenPoolTemplate.contractId,
        'remoteTokenPoolTemplateId': templateContracts.remoteTokenPoolTemplate.contractId,
        'tokenBridgeForChainTemplateId': templateContracts.tokenBridgeForChainTemplate.contractId,
        'attestTokenHandlerTemplateId': templateContracts.attestTokenHandlerTemplate.contractId,
        'undoneSequenceTemplateId': templateContracts.undoneSequenceTemplate.contractId,
        'refundAddress': randomAssetAddress(),
        'minimalConsistencyLevel': minimalConsistencyLevel
    }
    const state = tokenBridge.toState(initFields, initAsset, tokenBridgeAddress)
    const deps = Array.prototype.concat(
        governance.states(),
        wrappedAlph.states(),
        templateContracts.states()
    )
    return new TokenBridgeInfo(
        tokenBridge, state, deps, tokenBridgeAddress, governance, wrappedAlph.contractId, templateContracts
    )
}

function subContractAddress(parentId: string, pathHex: string): string {
    return addressFromContractId(subContractId(parentId, pathHex))
}

export function chainIdHex(chainId: number): string {
    return zeroPad(chainId.toString(16), 2)
}

export function attestTokenHandlerAddress(tokenBridgeId: string, remoteChainId: number): string {
    return subContractAddress(tokenBridgeId, '00' + chainIdHex(remoteChainId))
}

export function tokenBridgeForChainAddress(tokenBridgeId: string, remoteChainId: number): string {
    return subContractAddress(tokenBridgeId, '01' + chainIdHex(remoteChainId))
}

export function tokenPoolAddress(tokenBridgeId: string, tokenChainId: number, tokenId: string): string {
    const path = '02' + chainIdHex(tokenChainId) + tokenId
    return subContractAddress(tokenBridgeId, path)
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
    remoteTokenBridgeId: string
): Promise<TokenBridgeForChainInfo> {
    const contractAddress = tokenBridgeForChainAddress(tokenBridge.contractId, remoteChainId)
    const tokenBridgeForChainContract = await Contract.fromSource(provider, "token_bridge/token_bridge_for_chain.ral")
    const templateContracts = tokenBridge.templateContracts
    const initFields = {
        'governanceContractId': tokenBridge.governance.contractId,
        'localChainId': CHAIN_ID_ALEPHIUM,
        'localTokenBridgeId': tokenBridge.contractId,
        'remoteChainId': remoteChainId,
        'remoteTokenBridgeId': remoteTokenBridgeId,
        'next': 0,
        'next1': 0,
        'next2': 0,
        'undoneSequenceTemplateId': templateContracts.undoneSequenceTemplate.contractId,
        'refundAddress': randomAssetAddress(),
        'sendSequence': 0
    }
    const contractAsset: Asset = {alphAmount: alph(2)}
    const state = tokenBridgeForChainContract.toState(initFields, contractAsset, contractAddress)
    return new TokenBridgeForChainInfo(tokenBridgeForChainContract, state, tokenBridge.states(), contractAddress, remoteChainId)
}

export interface TokenBridgeFixture {
    tokenBridgeInfo: TokenBridgeInfo
}

export interface TokenBridgeForChainFixture extends TokenBridgeFixture {
    tokenBridgeForChainInfo: TokenBridgeForChainInfo
}

export interface WrappedAlphPoolTestFixture extends TokenBridgeForChainFixture {
    wrappedAlphPoolInfo: ContractInfo
    totalWrappedAlph: bigint
    totalBridged: bigint
}

export interface LocalTokenPoolTestFixture extends TokenBridgeForChainFixture {
    localTokenPoolInfo: ContractInfo
    localTokenId: string
    totalBridged: bigint
}

export interface RemoteTokenPoolTestFixture extends TokenBridgeForChainFixture {
    remoteTokenPoolInfo: ContractInfo
    remoteChainId: number
    remoteTokenId: string
    totalBridged: bigint
}

export async function newTokenBridgeFixture(provider: NodeProvider): Promise<TokenBridgeFixture> {
    const tokenBridgeInfo = await createTokenBridge(provider)
    return {tokenBridgeInfo}
}

export async function newTokenBridgeForChainFixture(
    provider: NodeProvider,
    remoteChainId: number,
    remoteTokenBridgeId: string
): Promise<TokenBridgeForChainFixture> {
    const tokenBridgeInfo = await createTokenBridge(provider)
    const tokenBridgeForChainInfo = await createTokenBridgeForChain(
        provider,
        tokenBridgeInfo,
        remoteChainId,
        remoteTokenBridgeId
    )
    return {tokenBridgeInfo, tokenBridgeForChainInfo}
}

export async function newWrappedAlphPoolFixture(
    provider: NodeProvider,
    remoteChainId: number,
    remoteTokenBridgeId: string,
    totalWrappedAlph: bigint = alph(10),
    totalBridged: bigint = alph(10)
): Promise<WrappedAlphPoolTestFixture> {
    const tokenBridgeInfo = await createTokenBridge(provider, totalWrappedAlph)
    const tokenBridgeForChainInfo = await createTokenBridgeForChain(
        provider,
        tokenBridgeInfo,
        remoteChainId,
        remoteTokenBridgeId
    )
    const address = tokenPoolAddress(tokenBridgeInfo.contractId, CHAIN_ID_ALEPHIUM, tokenBridgeInfo.wrappedAlphId)
    const asset: Asset = {
        alphAmount: minimalAlphInContract,
        tokens: [{
            id: tokenBridgeInfo.wrappedAlphId,
            amount: totalBridged
        }]
    }
    const wrappedAlphPoolInfo = await createContract(provider, 'token_bridge/wrapped_alph_pool.ral', {
        'tokenBridgeId': tokenBridgeInfo.contractId,
        'tokenChainId': CHAIN_ID_ALEPHIUM,
        'bridgeTokenId': tokenBridgeInfo.wrappedAlphId,
        'totalBridged': totalBridged,
        'decimals_': 0
    }, tokenBridgeForChainInfo.states(), asset, address)
    return {tokenBridgeInfo, tokenBridgeForChainInfo, wrappedAlphPoolInfo, totalWrappedAlph, totalBridged}
}

export async function newLocalTokenPoolFixture(
    provider: NodeProvider,
    remoteChainId: number,
    remoteTokenBridgeId: string,
    localTokenId: string,
    totalBridged: bigint = alph(10)
): Promise<LocalTokenPoolTestFixture> {
    const fixture = await newTokenBridgeForChainFixture(provider, remoteChainId, remoteTokenBridgeId)
    const tokenBridgeInfo = fixture.tokenBridgeInfo
    const tokenBridgeForChainInfo = fixture.tokenBridgeForChainInfo
    const address = tokenPoolAddress(tokenBridgeInfo.contractId, CHAIN_ID_ALEPHIUM, localTokenId)
    const asset: Asset = {
        alphAmount: minimalAlphInContract,
        tokens: [{
            id: localTokenId,
            amount: totalBridged
        }]
    }
    const localTokenPoolInfo = await createContract(provider, 'token_bridge/local_token_pool.ral', {
        'tokenBridgeId': tokenBridgeInfo.contractId,
        'tokenChainId': CHAIN_ID_ALEPHIUM,
        'bridgeTokenId': localTokenId,
        'totalBridged': totalBridged,
        'decimals_': 0
    }, tokenBridgeForChainInfo.states(), asset, address)
    return {tokenBridgeInfo, tokenBridgeForChainInfo, localTokenPoolInfo, localTokenId, totalBridged}
}

export async function newRemoteTokenPoolFixture(
    provider: NodeProvider,
    remoteChainId: number,
    remoteTokenBridgeId: string,
    remoteTokenId: string,
    symbol: string,
    name: string,
    decimals: number,
    address?: string,
    totalBridged: bigint = alph(10)
): Promise<RemoteTokenPoolTestFixture> {
    const fixture = await newTokenBridgeForChainFixture(provider, remoteChainId, remoteTokenBridgeId)
    const tokenBridgeInfo = fixture.tokenBridgeInfo
    const tokenBridgeForChainInfo = fixture.tokenBridgeForChainInfo
    const contractAddress =
        typeof address === 'undefined'
            ? tokenPoolAddress(tokenBridgeInfo.contractId, remoteChainId, remoteTokenId)
            : address
    const asset: Asset = {
        alphAmount: minimalAlphInContract,
        tokens: [{
            id: binToHex(contractIdFromAddress(contractAddress)),
            amount: totalBridged
        }]
    }
    const remoteTokenPoolInfo = await createContract(provider, 'token_bridge/remote_token_pool.ral', {
        'tokenBridgeId': tokenBridgeInfo.contractId,
        'tokenChainId': remoteChainId,
        'bridgeTokenId': remoteTokenId,
        'totalBridged': totalBridged,
        'symbol_': symbol,
        'name_': name,
        'decimals_': decimals
    }, tokenBridgeForChainInfo.states(), asset, contractAddress)
    return {tokenBridgeInfo, tokenBridgeForChainInfo, remoteTokenPoolInfo, remoteChainId, remoteTokenId, totalBridged}
}

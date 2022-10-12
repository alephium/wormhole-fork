import {
  Project,
  Contract,
  ContractState,
  subContractId,
  Asset,
  stringToHex,
  addressFromContractId,
  Fields,
  contractIdFromAddress,
  binToHex
} from '@alephium/web3'
import { createGovernance } from './governance-fixture'
import {
  CHAIN_ID_ALEPHIUM,
  ContractInfo,
  minimalAlphInContract,
  initAsset,
  randomContractAddress,
  randomContractId,
  randomAssetAddress,
  alph
} from './wormhole-fixture'
import { zeroPad } from '../../lib/utils'
import { createUnexecutedSequence } from './sequence-fixture'

export const tokenBridgeModule = zeroPad(stringToHex('TokenBridge'), 32)
export const minimalConsistencyLevel = 105n

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
    const buffer = Buffer.allocUnsafe(100)
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
    const buffer = Buffer.allocUnsafe(67)
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
    const buffer = Buffer.allocUnsafe(34)
    buffer.write(tokenBridgeModule, 0, 'hex')
    buffer.writeUint8(241, 32) // actionId, #f1
    buffer.writeUint8(this.minimalConsistencyLevel, 33)
    return buffer
  }
}

export class DestroyUnexecutedSequenceContracts {
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
    this.paths.forEach((path) => {
      buffer.writeBigUint64BE(BigInt(path), index)
      index += 8
    })
    return buffer
  }
}

export class UpdateRefundAddress {
  newRefundAddressHex: string

  constructor(newRefundAddressHex: string) {
    this.newRefundAddressHex = newRefundAddressHex
  }

  encode(): Uint8Array {
    const addressSize = this.newRefundAddressHex.length / 2
    const buffer = Buffer.allocUnsafe(33 + 2 + addressSize)
    buffer.write(tokenBridgeModule, 0, 'hex')
    buffer.writeUint8(242, 32) // actionId, #f2
    buffer.writeUint16BE(addressSize, 33)
    buffer.write(this.newRefundAddressHex, 35, 'hex')
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
    const buffer = Buffer.allocUnsafe(131)
    buffer.writeUint8(1, 0) // payloadId
    buffer.write(zeroPad(this.amount.toString(16), 32), 1, 'hex')
    buffer.write(this.tokenId, 33, 'hex')
    buffer.writeUint16BE(this.tokenChainId, 65)
    buffer.write(this.recipient, 67, 'hex')
    buffer.write(zeroPad(this.arbiterFee.toString(16), 32), 99, 'hex')
    return buffer
  }
}

export function createTestToken(): ContractInfo {
  const token = Project.contract('TestToken')
  const address = randomContractAddress()
  const state = token.toState({}, { alphAmount: minimalAlphInContract }, address)
  return new ContractInfo(token, state, [], address)
}

export interface TemplateContracts {
  wrappedAlphPoolTemplate: ContractInfo
  localTokenPoolTemplate: ContractInfo
  remoteTokenPoolTemplate: ContractInfo
  unexecutedSequenceTemplate: ContractInfo
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

function createTemplateContracts(): TemplateContracts {
  const wrappedAlphPool = createWrappedAlphPoolTemplate()
  const localTokenPool = createLocalTokenPoolTemplate()
  const remoteTokenPool = createRemoteTokenPoolTemplate()
  const attestTokenHandler = createAttestTokenHandlerTemplate()
  const tokenBridgeForChain = createTokenBridgeForChainTemplate()
  const unexecutedSequence = createUnexecutedSequence(randomContractId(), 0n, 0n)
  return {
    wrappedAlphPoolTemplate: wrappedAlphPool,
    localTokenPoolTemplate: localTokenPool,
    remoteTokenPoolTemplate: remoteTokenPool,
    attestTokenHandlerTemplate: attestTokenHandler,
    tokenBridgeForChainTemplate: tokenBridgeForChain,
    unexecutedSequenceTemplate: unexecutedSequence,

    states(): ContractState[] {
      return [
        wrappedAlphPool.selfState,
        localTokenPool.selfState,
        remoteTokenPool.selfState,
        attestTokenHandler.selfState,
        tokenBridgeForChain.selfState,
        unexecutedSequence.selfState
      ]
    }
  }
}

function createContract(
  name: string,
  initFields: Fields,
  deps: ContractState[] = [],
  asset: Asset = initAsset,
  address?: string
): ContractInfo {
  const contract = Project.contract(name)
  const contractAddress = typeof address === 'undefined' ? randomContractAddress() : address
  const state = contract.toState(initFields, asset, address)
  return new ContractInfo(contract, state, deps, contractAddress)
}

function createWrappedAlph(totalWrapped: bigint, wrappedAlphPoolCodeHash: string): ContractInfo {
  const contractId = randomContractId()
  const initAsset: Asset = {
    alphAmount: totalWrapped,
    tokens: [
      {
        id: contractId,
        amount: totalWrapped
      }
    ]
  }
  const initFields = {
    wrappedAlphPoolCodeHash: wrappedAlphPoolCodeHash,
    totalWrapped: totalWrapped
  }
  return createContract('WrappedAlph', initFields, [], initAsset, addressFromContractId(contractId))
}

function createWrappedAlphPoolTemplate(): ContractInfo {
  return createContract('WrappedAlphPool', {
    tokenBridgeId: '',
    tokenChainId: 0n,
    bridgeTokenId: '',
    totalBridged: 0n,
    decimals_: 0n
  })
}

function createLocalTokenPoolTemplate(): ContractInfo {
  return createContract('LocalTokenPool', {
    tokenBridgeId: '',
    tokenChainId: 0n,
    bridgeTokenId: '',
    totalBridged: 0n,
    decimals_: 0n
  })
}

function createRemoteTokenPoolTemplate(): ContractInfo {
  return createContract('RemoteTokenPool', {
    tokenBridgeId: '',
    tokenChainId: 0n,
    bridgeTokenId: '',
    totalBridged: 0n,
    symbol_: '',
    name_: '',
    decimals_: 0n,
    sequence_: 0n
  })
}

function createAttestTokenHandlerTemplate(): ContractInfo {
  return createContract('AttestTokenHandler', {
    governance: '',
    localTokenBridge: '',
    remoteChainId: 0n,
    remoteTokenBridgeId: '',
    receivedSequence: 0n
  })
}

function createTokenBridgeForChainTemplate(): ContractInfo {
  return createContract('TokenBridgeForChain', {
    governance: '',
    localChainId: 0n,
    localTokenBridgeId: '',
    remoteChainId: 0n,
    remoteTokenBridgeId: '',
    start: 0n,
    firstNext256: 0n,
    secondNext256: 0n,
    unexecutedSequenceTemplateId: '',
    sendSequence: 0n
  })
}

export function createTokenBridgeFactory(templateContracts: TemplateContracts): ContractInfo {
  const tokenBridgeFactory = Project.contract('TokenBridgeFactory')
  const initFields = {
    wrappedAlphPoolTemplateId: templateContracts.wrappedAlphPoolTemplate.contractId,
    localTokenPoolTemplateId: templateContracts.localTokenPoolTemplate.contractId,
    remoteTokenPoolTemplateId: templateContracts.remoteTokenPoolTemplate.contractId,
    tokenBridgeForChainTemplateId: templateContracts.tokenBridgeForChainTemplate.contractId,
    attestTokenHandlerTemplateId: templateContracts.attestTokenHandlerTemplate.contractId,
    unexecutedSequenceTemplateId: templateContracts.unexecutedSequenceTemplate.contractId
  }
  const address = randomContractAddress()
  const state = tokenBridgeFactory.toState(initFields, initAsset, address)
  return new ContractInfo(tokenBridgeFactory, state, templateContracts.states(), address)
}

export function createTokenBridge(totalWrappedAlph = 0n, address?: string, receivedSequence?: bigint): TokenBridgeInfo {
  const tokenBridge = Project.contract('TokenBridge')
  const governance = createGovernance()
  const wrappedAlphPoolCodeHash = Project.contract('WrappedAlphPool').codeHash
  const wrappedAlph = createWrappedAlph(totalWrappedAlph, wrappedAlphPoolCodeHash)
  const templateContracts = createTemplateContracts()
  const tokenBridgeFactory = createTokenBridgeFactory(templateContracts)
  const tokenBridgeAddress = typeof address === 'undefined' ? randomContractAddress() : address
  const initFields = {
    governance: governance.contractId,
    localChainId: BigInt(CHAIN_ID_ALEPHIUM),
    receivedSequence: receivedSequence ?? 0n,
    sendSequence: 0n,
    wrappedAlphId: wrappedAlph.contractId,
    tokenBridgeFactory: tokenBridgeFactory.contractId,
    minimalConsistencyLevel: minimalConsistencyLevel,
    refundAddress: randomAssetAddress()
  }
  const state = tokenBridge.toState(initFields, initAsset, tokenBridgeAddress)
  const deps = Array.prototype.concat(governance.states(), wrappedAlph.states(), tokenBridgeFactory.states())
  return new TokenBridgeInfo(
    tokenBridge,
    state,
    deps,
    tokenBridgeAddress,
    governance,
    wrappedAlph.contractId,
    templateContracts
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

export function createAttestTokenHandler(
  tokenBridge: TokenBridgeInfo,
  remoteChainId: number,
  remoteTokenBridgeId: string,
  address?: string
): ContractInfo {
  const contractAddress =
    typeof address === 'undefined' ? attestTokenHandlerAddress(tokenBridge.contractId, remoteChainId) : address
  const attestTokenHandlerContract = Project.contract('AttestTokenHandler')
  const initFields = {
    governance: tokenBridge.governance.contractId,
    localChainId: BigInt(CHAIN_ID_ALEPHIUM),
    localTokenBridge: tokenBridge.contractId,
    remoteChainId: BigInt(remoteChainId),
    remoteTokenBridgeId: remoteTokenBridgeId,
    receivedSequence: 0n
  }
  const state = attestTokenHandlerContract.toState(initFields, initAsset, contractAddress)
  return new ContractInfo(attestTokenHandlerContract, state, tokenBridge.states(), contractAddress)
}

export function createTokenBridgeForChain(
  tokenBridge: TokenBridgeInfo,
  remoteChainId: number,
  remoteTokenBridgeId: string
): TokenBridgeForChainInfo {
  const contractAddress = tokenBridgeForChainAddress(tokenBridge.contractId, remoteChainId)
  const tokenBridgeForChainContract = Project.contract('TokenBridgeForChain')
  const templateContracts = tokenBridge.templateContracts
  const initFields = {
    governance: tokenBridge.governance.contractId,
    localChainId: BigInt(CHAIN_ID_ALEPHIUM),
    localTokenBridgeId: tokenBridge.contractId,
    remoteChainId: BigInt(remoteChainId),
    remoteTokenBridgeId: remoteTokenBridgeId,
    start: 0n,
    firstNext256: 0n,
    secondNext256: 0n,
    unexecutedSequenceTemplateId: templateContracts.unexecutedSequenceTemplate.contractId,
    sendSequence: 0n
  }
  const contractAsset: Asset = { alphAmount: alph(2) }
  const state = tokenBridgeForChainContract.toState(initFields, contractAsset, contractAddress)
  return new TokenBridgeForChainInfo(
    tokenBridgeForChainContract,
    state,
    tokenBridge.states(),
    contractAddress,
    remoteChainId
  )
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

export function newTokenBridgeFixture(): TokenBridgeFixture {
  const tokenBridgeInfo = createTokenBridge()
  return { tokenBridgeInfo }
}

export function newTokenBridgeForChainFixture(
  remoteChainId: number,
  remoteTokenBridgeId: string
): TokenBridgeForChainFixture {
  const tokenBridgeInfo = createTokenBridge()
  const tokenBridgeForChainInfo = createTokenBridgeForChain(tokenBridgeInfo, remoteChainId, remoteTokenBridgeId)
  return { tokenBridgeInfo, tokenBridgeForChainInfo }
}

export function newWrappedAlphPoolFixture(
  remoteChainId: number,
  remoteTokenBridgeId: string,
  totalWrappedAlph: bigint = alph(10),
  totalBridged: bigint = alph(10)
): WrappedAlphPoolTestFixture {
  const tokenBridgeInfo = createTokenBridge(totalWrappedAlph)
  const tokenBridgeForChainInfo = createTokenBridgeForChain(tokenBridgeInfo, remoteChainId, remoteTokenBridgeId)
  const address = tokenPoolAddress(tokenBridgeInfo.contractId, CHAIN_ID_ALEPHIUM, tokenBridgeInfo.wrappedAlphId)
  const asset: Asset = {
    alphAmount: minimalAlphInContract,
    tokens: [
      {
        id: tokenBridgeInfo.wrappedAlphId,
        amount: totalBridged
      }
    ]
  }
  const wrappedAlphPoolInfo = createContract(
    'WrappedAlphPool',
    {
      tokenBridgeId: tokenBridgeInfo.contractId,
      tokenChainId: BigInt(CHAIN_ID_ALEPHIUM),
      bridgeTokenId: tokenBridgeInfo.wrappedAlphId,
      totalBridged: totalBridged,
      decimals_: 0n
    },
    tokenBridgeForChainInfo.states(),
    asset,
    address
  )
  return { tokenBridgeInfo, tokenBridgeForChainInfo, wrappedAlphPoolInfo, totalWrappedAlph, totalBridged }
}

export function newLocalTokenPoolFixture(
  remoteChainId: number,
  remoteTokenBridgeId: string,
  localTokenId: string,
  totalBridged: bigint = alph(10)
): LocalTokenPoolTestFixture {
  const fixture = newTokenBridgeForChainFixture(remoteChainId, remoteTokenBridgeId)
  const tokenBridgeInfo = fixture.tokenBridgeInfo
  const tokenBridgeForChainInfo = fixture.tokenBridgeForChainInfo
  const address = tokenPoolAddress(tokenBridgeInfo.contractId, CHAIN_ID_ALEPHIUM, localTokenId)
  const asset: Asset = {
    alphAmount: minimalAlphInContract,
    tokens: [
      {
        id: localTokenId,
        amount: totalBridged
      }
    ]
  }
  const localTokenPoolInfo = createContract(
    'LocalTokenPool',
    {
      tokenBridgeId: tokenBridgeInfo.contractId,
      tokenChainId: BigInt(CHAIN_ID_ALEPHIUM),
      bridgeTokenId: localTokenId,
      totalBridged: totalBridged,
      decimals_: 0n
    },
    tokenBridgeForChainInfo.states(),
    asset,
    address
  )
  return { tokenBridgeInfo, tokenBridgeForChainInfo, localTokenPoolInfo, localTokenId, totalBridged }
}

export function newRemoteTokenPoolFixture(
  remoteChainId: number,
  remoteTokenBridgeId: string,
  remoteTokenId: string,
  symbol: string,
  name: string,
  decimals: number,
  sequence: number,
  address?: string,
  totalBridged: bigint = alph(10)
): RemoteTokenPoolTestFixture {
  const fixture = newTokenBridgeForChainFixture(remoteChainId, remoteTokenBridgeId)
  const tokenBridgeInfo = fixture.tokenBridgeInfo
  const tokenBridgeForChainInfo = fixture.tokenBridgeForChainInfo
  const contractAddress =
    typeof address === 'undefined'
      ? tokenPoolAddress(tokenBridgeInfo.contractId, remoteChainId, remoteTokenId)
      : address
  const asset: Asset = {
    alphAmount: minimalAlphInContract,
    tokens: [
      {
        id: binToHex(contractIdFromAddress(contractAddress)),
        amount: totalBridged
      }
    ]
  }
  const remoteTokenPoolInfo = createContract(
    'RemoteTokenPool',
    {
      tokenBridgeId: tokenBridgeInfo.contractId,
      tokenChainId: BigInt(remoteChainId),
      bridgeTokenId: remoteTokenId,
      totalBridged: totalBridged,
      symbol_: symbol,
      name_: name,
      decimals_: BigInt(decimals),
      sequence_: BigInt(sequence)
    },
    tokenBridgeForChainInfo.states(),
    asset,
    contractAddress
  )
  return { tokenBridgeInfo, tokenBridgeForChainInfo, remoteTokenPoolInfo, remoteChainId, remoteTokenId, totalBridged }
}

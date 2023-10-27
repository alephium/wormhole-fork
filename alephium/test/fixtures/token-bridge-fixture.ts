import {
  ContractFactory,
  ContractState,
  Asset,
  stringToHex,
  addressFromContractId,
  Fields,
  contractIdFromAddress,
  subContractId,
  binToHex,
  ALPH_TOKEN_ID,
  Token
} from '@alephium/web3'
import { createGovernance } from './governance-fixture'
import {
  CHAIN_ID_ALEPHIUM,
  ContractFixture,
  minimalAlphInContract,
  randomContractAddress,
  randomContractId,
  alph,
  randomAssetAddress,
  randomByte32Hex
} from './wormhole-fixture'
import { zeroPad } from '../../lib/utils'
import { createUnexecutedSequence } from './sequence-fixture'
import {
  AttestTokenHandler,
  AttestTokenHandlerTypes,
  GovernanceTypes,
  LocalTokenPool,
  LocalTokenPoolTypes,
  RemoteTokenPool,
  RemoteTokenPoolTypes,
  TestToken,
  TokenBridge,
  TokenBridgeTypes,
  TokenBridgeFactory,
  TokenBridgeForChain,
  TokenBridgeForChainTypes,
  UnexecutedSequenceTypes,
  BridgeRewardRouter
} from '../../artifacts/ts'

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
    const recipientSize = this.recipient.length / 2
    const buffer = Buffer.allocUnsafe(101 + recipientSize)
    buffer.writeUint8(1, 0) // payloadId
    buffer.write(zeroPad(this.amount.toString(16), 32), 1, 'hex')
    buffer.write(this.tokenId, 33, 'hex')
    buffer.writeUint16BE(this.tokenChainId, 65)
    buffer.writeUint16BE(recipientSize, 67)
    buffer.write(this.recipient, 69, 'hex')
    buffer.write(zeroPad(this.arbiterFee.toString(16), 32), 69 + recipientSize, 'hex')
    return buffer
  }
}

export function createTestToken() {
  const address = randomContractAddress()
  const initFields = {
    symbol: randomByte32Hex(),
    name: randomByte32Hex(),
    decimals: 18n,
    totalSupply: 1n << 255n
  }
  const state = TestToken.stateForTest(initFields, undefined, address)
  return new ContractFixture(state, [])
}

export interface TemplateContracts {
  localTokenPoolTemplate: ContractFixture<LocalTokenPoolTypes.Fields>
  remoteTokenPoolTemplate: ContractFixture<RemoteTokenPoolTypes.Fields>
  unexecutedSequenceTemplate: ContractFixture<UnexecutedSequenceTypes.Fields>
  tokenBridgeForChainTemplate: ContractFixture<TokenBridgeForChainTypes.Fields>
  attestTokenHandlerTemplate: ContractFixture<AttestTokenHandlerTypes.Fields>

  states(): ContractState[]
}

export class TokenBridgeFixture extends ContractFixture<TokenBridgeTypes.Fields> {
  governance: ContractFixture<GovernanceTypes.Fields>
  templateContracts: TemplateContracts

  constructor(
    selfState: ContractState<TokenBridgeTypes.Fields>,
    deps: ContractState[],
    governance: ContractFixture<GovernanceTypes.Fields>,
    templateContracts: TemplateContracts
  ) {
    super(selfState, deps)
    this.governance = governance
    this.templateContracts = templateContracts
  }
}

export class TokenBridgeForChainFixture extends ContractFixture<TokenBridgeForChainTypes.Fields> {
  remoteChainId: number

  constructor(selfState: ContractState<TokenBridgeForChainTypes.Fields>, deps: ContractState[], remoteChainId: number) {
    super(selfState, deps)
    this.remoteChainId = remoteChainId
  }
}

export function createTemplateContracts(): TemplateContracts {
  const localTokenPool = createLocalTokenPoolTemplate()
  const remoteTokenPool = createRemoteTokenPoolTemplate()
  const attestTokenHandler = createAttestTokenHandlerTemplate()
  const tokenBridgeForChain = createTokenBridgeForChainTemplate()
  const unexecutedSequence = createUnexecutedSequence(randomContractId(), 0n, 0n)
  return {
    localTokenPoolTemplate: localTokenPool,
    remoteTokenPoolTemplate: remoteTokenPool,
    attestTokenHandlerTemplate: attestTokenHandler,
    tokenBridgeForChainTemplate: tokenBridgeForChain,
    unexecutedSequenceTemplate: unexecutedSequence,

    states(): ContractState[] {
      return [
        localTokenPool.selfState,
        remoteTokenPool.selfState,
        attestTokenHandler.selfState,
        tokenBridgeForChain.selfState,
        unexecutedSequence.selfState
      ]
    }
  }
}

function createContract<T extends Fields>(
  factory: ContractFactory<any, T>,
  initFields: T,
  deps: ContractState[] = [],
  asset?: Asset,
  address?: string
) {
  const contractAddress = address ?? randomContractAddress()
  const state = factory.stateForTest(initFields, asset ?? undefined, contractAddress)
  return new ContractFixture(state, deps)
}

function createLocalTokenPoolTemplate() {
  return createContract(LocalTokenPool, {
    tokenBridge: '',
    tokenChainId: 0n,
    bridgeTokenId: '',
    totalBridged: 0n,
    decimals_: 0n
  })
}

function createRemoteTokenPoolTemplate() {
  return createContract(RemoteTokenPool, {
    tokenBridge: '',
    tokenChainId: 0n,
    bridgeTokenId: '',
    totalBridged: 0n,
    symbol_: '',
    name_: '',
    decimals_: 0n,
    sequence_: 0n
  })
}

function createAttestTokenHandlerTemplate() {
  return createContract(AttestTokenHandler, {
    governance: '',
    localTokenBridge: '',
    targetChainId: 0n,
    targetTokenBridgeId: '',
    receivedSequence: 0n,
    isLocalHandler: false
  })
}

function createTokenBridgeForChainTemplate() {
  return createContract(TokenBridgeForChain, {
    governance: '',
    localChainId: 0n,
    localTokenBridge: '',
    remoteChainId: 0n,
    remoteTokenBridgeId: '',
    start: 0n,
    firstNext256: 0n,
    secondNext256: 0n,
    unexecutedSequenceTemplateId: '',
    sendSequence: 0n
  })
}

export function createTokenBridgeFactory(templateContracts: TemplateContracts) {
  const initFields = {
    localTokenPoolTemplateId: templateContracts.localTokenPoolTemplate.contractId,
    remoteTokenPoolTemplateId: templateContracts.remoteTokenPoolTemplate.contractId,
    tokenBridgeForChainTemplateId: templateContracts.tokenBridgeForChainTemplate.contractId,
    attestTokenHandlerTemplateId: templateContracts.attestTokenHandlerTemplate.contractId,
    unexecutedSequenceTemplateId: templateContracts.unexecutedSequenceTemplate.contractId
  }
  const address = randomContractAddress()
  const state = TokenBridgeFactory.stateForTest(initFields, undefined, address)
  return new ContractFixture(state, templateContracts.states())
}

export function createTokenBridge(
  address?: string,
  receivedSequence?: bigint,
  messageFee?: bigint
): TokenBridgeFixture {
  const governance = createGovernance(undefined, messageFee)
  const tokenBridgeAddress = address ?? randomContractAddress()
  const initFields = {
    governance: governance.contractId,
    localChainId: BigInt(CHAIN_ID_ALEPHIUM),
    receivedSequence: receivedSequence ?? 0n,
    sendSequence: 0n,
    tokenBridgeFactory: governance.tokenBridgeFactory.contractId,
    minimalConsistencyLevel: minimalConsistencyLevel,
    refundAddress: randomAssetAddress()
  }
  const state = TokenBridge.stateForTest(initFields, undefined, tokenBridgeAddress)
  const deps = Array.prototype.concat(governance.states(), governance.tokenBridgeFactory.states())
  return new TokenBridgeFixture(state, deps, governance, governance.templateContracts)
}

function subContractAddress(parentId: string, pathHex: string): string {
  return addressFromContractId(subContractId(parentId, pathHex, 0))
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
  tokenBridge: TokenBridgeFixture,
  remoteChainId: number,
  remoteTokenBridgeId: string,
  address?: string
) {
  const contractAddress = address ?? attestTokenHandlerAddress(tokenBridge.contractId, remoteChainId)
  const initFields = {
    governance: tokenBridge.governance.contractId,
    localChainId: BigInt(CHAIN_ID_ALEPHIUM),
    localTokenBridge: tokenBridge.contractId,
    targetChainId: BigInt(remoteChainId),
    targetTokenBridgeId: remoteTokenBridgeId,
    receivedSequence: 0n,
    isLocalHandler: remoteChainId === CHAIN_ID_ALEPHIUM
  }
  const state = AttestTokenHandler.stateForTest(initFields, undefined, contractAddress)
  return new ContractFixture(state, tokenBridge.states())
}

export function createTokenBridgeForChain(
  tokenBridge: TokenBridgeFixture,
  remoteChainId: number,
  remoteTokenBridgeId: string
): TokenBridgeForChainFixture {
  const contractAddress = tokenBridgeForChainAddress(tokenBridge.contractId, remoteChainId)
  const templateContracts = tokenBridge.templateContracts
  const initFields = {
    governance: tokenBridge.governance.contractId,
    localChainId: BigInt(CHAIN_ID_ALEPHIUM),
    localTokenBridge: tokenBridge.contractId,
    remoteChainId: BigInt(remoteChainId),
    remoteTokenBridgeId: remoteTokenBridgeId,
    start: 0n,
    firstNext256: 0n,
    secondNext256: 0n,
    unexecutedSequenceTemplateId: templateContracts.unexecutedSequenceTemplate.contractId,
    sendSequence: 0n
  }
  const contractAsset: Asset = { alphAmount: alph(2) }
  const state = TokenBridgeForChain.stateForTest(initFields, contractAsset, contractAddress)
  return new TokenBridgeForChainFixture(state, tokenBridge.states(), remoteChainId)
}

export interface TokenBridgeForChainTestFixture {
  tokenBridge: TokenBridgeFixture
  tokenBridgeForChain: TokenBridgeForChainFixture
}

export interface LocalTokenPoolTestFixture extends TokenBridgeForChainTestFixture {
  localTokenPool: ContractFixture<LocalTokenPoolTypes.Fields>
  localTokenId: string
  totalBridged: bigint
}

export interface RemoteTokenPoolTestFixture extends TokenBridgeForChainTestFixture {
  remoteTokenPool: ContractFixture<RemoteTokenPoolTypes.Fields>
  remoteChainId: number
  remoteTokenId: string
  totalBridged: bigint
}

export function newTokenBridgeForChainTestFixture(
  remoteChainId: number,
  remoteTokenBridgeId: string,
  messageFee?: bigint
): TokenBridgeForChainTestFixture {
  const tokenBridge = createTokenBridge(undefined, undefined, messageFee)
  const tokenBridgeForChain = createTokenBridgeForChain(tokenBridge, remoteChainId, remoteTokenBridgeId)
  return { tokenBridge, tokenBridgeForChain }
}

export function newLocalTokenPoolTestFixture(
  remoteChainId: number,
  remoteTokenBridgeId: string,
  localTokenId: string,
  messageFee?: bigint
): LocalTokenPoolTestFixture {
  const totalBridged = alph(10)
  const fixture = newTokenBridgeForChainTestFixture(remoteChainId, remoteTokenBridgeId, messageFee)
  const tokenBridge = fixture.tokenBridge
  const tokenBridgeForChain = fixture.tokenBridgeForChain
  const address = tokenPoolAddress(tokenBridge.contractId, CHAIN_ID_ALEPHIUM, localTokenId)
  const asset: Asset = {
    alphAmount: localTokenId === ALPH_TOKEN_ID ? minimalAlphInContract + totalBridged : minimalAlphInContract,
    tokens: localTokenId === ALPH_TOKEN_ID ? [] : [{ id: localTokenId, amount: totalBridged }]
  }
  const localTokenPool = createContract(
    LocalTokenPool,
    {
      tokenBridge: tokenBridge.contractId,
      tokenChainId: BigInt(CHAIN_ID_ALEPHIUM),
      bridgeTokenId: localTokenId,
      totalBridged: totalBridged,
      decimals_: 0n
    },
    tokenBridgeForChain.states(),
    asset,
    address
  )
  return { tokenBridge, tokenBridgeForChain, localTokenPool, localTokenId, totalBridged }
}

export function newRemoteTokenPoolTestFixture(
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
  const fixture = newTokenBridgeForChainTestFixture(remoteChainId, remoteTokenBridgeId)
  const contractAddress = address ?? tokenPoolAddress(fixture.tokenBridge.contractId, remoteChainId, remoteTokenId)
  const asset: Asset = {
    alphAmount: minimalAlphInContract,
    tokens: [
      {
        id: binToHex(contractIdFromAddress(contractAddress)),
        amount: totalBridged
      }
    ]
  }
  const remoteTokenPool = createContract(
    RemoteTokenPool,
    {
      tokenBridge: fixture.tokenBridge.contractId,
      tokenChainId: BigInt(remoteChainId),
      bridgeTokenId: remoteTokenId,
      totalBridged: totalBridged,
      symbol_: symbol,
      name_: name,
      decimals_: BigInt(decimals),
      sequence_: BigInt(sequence)
    },
    fixture.tokenBridgeForChain.states(),
    asset,
    contractAddress
  )
  return { ...fixture, remoteTokenPool, remoteChainId, remoteTokenId, totalBridged }
}

function sameTokens(expected: Token[], have: Token[]): boolean {
  return expected.every((a) => have.some((b) => a.amount === b.amount && a.id === b.id))
}

export function expectAssetsEqual(expected: Asset[], have: Asset[]) {
  expect(expected.length).toEqual(have.length)
  expected.forEach((a) =>
    expect(have.some((b) => a.alphAmount === b.alphAmount && sameTokens(a.tokens ?? [], b.tokens ?? [])))
  )
}

export function createBridgeRewardRouter(alphAmount: bigint): ContractFixture<any> {
  const address = randomContractAddress()
  return new ContractFixture(
    BridgeRewardRouter.stateForTest({ alphChainId: BigInt(CHAIN_ID_ALEPHIUM) }, { alphAmount }, address),
    []
  )
}

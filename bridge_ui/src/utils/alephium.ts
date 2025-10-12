import {
  ALEPHIUM_BRIDGE_ADDRESS,
  ALEPHIUM_BRIDGE_GROUP_INDEX,
  ALEPHIUM_POLLING_INTERVAL,
  ALEPHIUM_REMOTE_TOKEN_POOL_CODE_HASH,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  CLUSTER
} from "./consts";
import {
  ChainId,
  parseSequenceFromLogAlph,
  CHAIN_ID_ALEPHIUM,
  WormholeWrappedInfo,
  parseTargetChainFromLogAlph,
  getTokenPoolId,
  contractExists,
  extractBodyFromVAA,
  getRemoteTokenInfoFromContractState,
  createLocalTokenPoolOnAlph,
  getAttestTokenHandlerId,
  getLocalTokenInfo,
  alephium_contracts,
  isSequenceExecuted
} from '@alephium/wormhole-sdk';
import { TokenInfo, ALPH, TokenList } from "@alephium/token-list";
import alephiumIcon from "../icons/alephium.svg";
import {
  NodeProvider,
  node,
  addressFromContractId,
  groupOfAddress,
  ALPH_TOKEN_ID,
  isHexString,
  SignerProvider,
  isBase58,
  binToHex,
  contractIdFromAddress,
  sleep,
  MINIMAL_CONTRACT_DEPOSIT
} from '@alephium/web3';
import * as base58 from 'bs58'
import i18n from "../i18n";

const WormholeMessageEventIndex = 0
export const AlephiumBlockTime = 8000 // 8 seconds in ms

let tokenListCache: TokenList | undefined = undefined

async function fetchTokenList(): Promise<TokenList> {
  const file = CLUSTER === 'mainnet' ? 'mainnet.json' : 'testnet.json'
  const url = `https://raw.githubusercontent.com/alephium/token-list/master/tokens/${file}`
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(i18n.t('Failed to fetch token list from {{ url }}', { url }))
  }
  const tokenList =  await response.json()
  tokenListCache = tokenList
  return tokenList
}

async function getTokenFromTokenList(tokenId: string): Promise<TokenInfo & { nameOnChain?: string; symbolOnChain?: string } | undefined> {
  if (tokenListCache !== undefined) {
    let result = tokenListCache.tokens.find((t) => t.id.toLowerCase() === tokenId.toLowerCase())
    if (result === undefined) { // update the cache
      const tokenList = await fetchTokenList()
      result = tokenList.tokens.find((t) => t.id.toLowerCase() === tokenId.toLowerCase())
    }
    return result
  }

  const tokenList = await fetchTokenList()
  return tokenList.tokens.find((t) => t.id.toLowerCase() === tokenId.toLowerCase())
}

export class AlphTxInfo {
  blockHash: string
  blockHeight: number
  blockTimestamp: number
  txId: string
  sequence: string
  targetChain: ChainId
  confirmations: number

  constructor(blockHeader: node.BlockHeaderEntry, txId: string, sequence: string, targetChain: ChainId, confirmations: number) {
    this.blockHash = blockHeader.hash
    this.blockHeight = blockHeader.height
    this.blockTimestamp = blockHeader.timestamp
    this.txId = txId
    this.sequence = sequence
    this.targetChain = targetChain
    this.confirmations = confirmations
  }
}

export async function waitALPHTxConfirmed(provider: NodeProvider, txId: string, confirmations: number): Promise<node.Confirmed> {
  try {
    const txStatus = await provider.transactions.getTransactionsStatus({txId: txId})
    if (isAlphTxConfirmed(txStatus) && txStatus.chainConfirmations >= confirmations) {
      return txStatus as node.Confirmed
    }
  } catch (error) {
    console.error(`${i18n.t('Failed to get tx status')}, tx id: ${txId}`)
  }
  await sleep(ALEPHIUM_POLLING_INTERVAL)
  return waitALPHTxConfirmed(provider, txId, confirmations)
}

async function getTxInfo(provider: NodeProvider, txId: string) {
  const events = await provider.events.getEventsTxIdTxid(txId, { group: ALEPHIUM_BRIDGE_GROUP_INDEX })
  const event = events.events.find((event) => event.contractAddress === ALEPHIUM_BRIDGE_ADDRESS)
  if (typeof event === 'undefined') {
    return Promise.reject(`${i18n.t('Failed to get event for tx')}: ${txId}`)
  }
  if (event.eventIndex !== WormholeMessageEventIndex) {
    return Promise.reject("invalid event index: " + event.eventIndex)
  }
  const sender = event.fields[0]
  if (sender.type !== 'ByteVec') {
    return Promise.reject("invalid sender, expect ByteVec type, have: " + sender.type)
  }
  const senderContractId = (sender as node.ValByteVec).value
  if (senderContractId !== ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID) {
    return Promise.reject("invalid sender, expect token bridge contract id, have: " + senderContractId)
  }
  const sequence = parseSequenceFromLogAlph(event)
  const targetChain = parseTargetChainFromLogAlph(event)
  return { sequence, targetChain}
}

export async function waitTxConfirmedAndGetTxInfo(provider: NodeProvider, txId: string): Promise<AlphTxInfo> {
  const confirmed = await waitALPHTxConfirmed(provider, txId, 1)
  const { sequence, targetChain } = await getTxInfo(provider, txId)
  const blockHeader = await provider.blockflow.getBlockflowHeadersBlockHash(confirmed.blockHash)
  return new AlphTxInfo(blockHeader, txId, sequence, targetChain, confirmed.chainConfirmations)
}

export async function getAlphTxInfoByTxId(provider: NodeProvider, txId: string) {
  const confirmed = await waitALPHTxConfirmed(provider, txId, 1)
  const txInfo = await getTxInfo(provider, txId)
  return { ...txInfo, confirmations: confirmed.chainConfirmations }
}

export function isAlphTxNotFound(txStatus: node.TxStatus): Boolean {
  return txStatus.type === "TxNotFound"
}

export function isAlphTxConfirmed(txStatus: node.TxStatus): txStatus is node.Confirmed {
  return txStatus.type === "Confirmed"
}

export function getEmitterChainId(signedVAA: Uint8Array): ChainId {
  const payload = extractBodyFromVAA(signedVAA)
  const emitterChainId = Buffer.from(payload).readUInt16BE(8)
  return emitterChainId as ChainId
}

async function localTokenPoolExists(nodeProvider: NodeProvider, tokenId: string): Promise<boolean> {
  if (tokenId.length !== 64) {
    throw Error("invalid token id " + tokenId)
  }
  const localTokenPoolId = getTokenPoolId(ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID, CHAIN_ID_ALEPHIUM, tokenId, ALEPHIUM_BRIDGE_GROUP_INDEX)
  return await contractExists(localTokenPoolId, nodeProvider)
}

export const ALPHTokenInfo: TokenInfo = {
  ...ALPH,
  logoURI: alephiumIcon
}

export async function getAlephiumTokenInfo(provider: NodeProvider, tokenId: string): Promise<TokenInfo | undefined> {
  if (tokenId === ALPH_TOKEN_ID) {
    return ALPHTokenInfo
  }

  const tokenInfo = await getTokenFromTokenList(tokenId)
  if (tokenInfo !== undefined) {
    return tokenInfo
  }

  const tokenAddress = addressFromContractId(tokenId)
  try {
    const state = await provider.contracts.getContractsAddressState(tokenAddress)
    if (state.codeHash === ALEPHIUM_REMOTE_TOKEN_POOL_CODE_HASH) {
      return getRemoteTokenInfoFromContractState(state)
    }

    const exist = await localTokenPoolExists(provider, tokenId)
    if (!exist) {
      return undefined
    }
    if (CLUSTER === 'devnet') {
      return await getLocalTokenInfo(provider, tokenId)
    }
    return undefined
  } catch (error) {
    console.log(`${i18n.t('Failed to get alephium token info')}, ${i18n.t('Error')}: ${error}`)
    return undefined
  }
}

export async function getAlephiumTokenLogoAndSymbol(tokenId: string) {
  if (tokenId === ALPH_TOKEN_ID) {
    return { logoURI: alephiumIcon, symbol: 'ALPH' }
  }
  const tokenInfo = await getTokenFromTokenList(tokenId)
  if (tokenInfo === undefined) return undefined
  return { logoURI: tokenInfo.logoURI, symbol: tokenInfo.symbol }
}

export async function getAlephiumTokenLogoURI(tokenId: string): Promise<string | undefined> {
  return tokenId === ALPH_TOKEN_ID
    ? alephiumIcon
    : (await getTokenFromTokenList(tokenId))?.logoURI
}

export async function getAndCheckLocalTokenInfo(provider: NodeProvider, tokenId: string): Promise<TokenInfo> {
  const onChainTokenInfo = await getLocalTokenInfo(provider, tokenId)
  if (CLUSTER === 'devnet' || tokenId === ALPH_TOKEN_ID) {
    return onChainTokenInfo
  }

  const tokenInfo = await getTokenFromTokenList(tokenId)
  if (tokenInfo === undefined) {
    throw new Error(i18n.t('Token {{ tokenId }} does not exists in the token-list', { tokenId }))
  }
  if (
    (tokenInfo.name === onChainTokenInfo.name || tokenInfo.nameOnChain === onChainTokenInfo.name) &&
    (tokenInfo.symbol === onChainTokenInfo.symbol || tokenInfo.symbolOnChain === onChainTokenInfo.symbol) &&
    (tokenInfo.decimals === onChainTokenInfo.decimals)
  ) {
    return onChainTokenInfo
  }
  throw new Error(i18n.t('Invalid token info, expected: {{ localTokenInfo }}, have: {{ tokenInfo }}', { localTokenInfo: onChainTokenInfo, tokenInfo }))
}

export async function getAlephiumTokenWrappedInfo(tokenId: string, provider: NodeProvider): Promise<WormholeWrappedInfo> {
  if (tokenId === ALPH_TOKEN_ID) {
    return {
      isWrapped: false,
      chainId: CHAIN_ID_ALEPHIUM,
      assetAddress: Buffer.from(tokenId, 'hex')
    }
  }
  const tokenAddress = addressFromContractId(tokenId)
  return provider
    .contracts
    .getContractsAddressState(tokenAddress)
    .then(state => {
      if (state.codeHash === ALEPHIUM_REMOTE_TOKEN_POOL_CODE_HASH) {
        const tokenInfo = getRemoteTokenInfoFromContractState(state)
        const originalAsset = Buffer.from(tokenInfo.id, 'hex')
        return {
          isWrapped: true,
          chainId: tokenInfo.tokenChainId,
          assetAddress: originalAsset,
        }
      } else {
        return {
          isWrapped: false,
          chainId: CHAIN_ID_ALEPHIUM,
          assetAddress: Buffer.from(tokenId, 'hex'),
        }
      }
    })
}

export function tryGetContractId(idOrAddress: string): string {
  if (idOrAddress.length === 64 && isHexString(idOrAddress)) {
    return idOrAddress
  }
  if (isBase58(idOrAddress)) {
    return binToHex(contractIdFromAddress(idOrAddress))
  }
  throw new Error(`${i18n.t('Invalid contract id or contract address')}: ${idOrAddress}`)
}

export function validateAlephiumRecipientAddress(recipient: Uint8Array): boolean {
  const address = base58.encode(recipient)
  return groupOfAddress(address) === ALEPHIUM_BRIDGE_GROUP_INDEX
}

export function isValidAlephiumTokenId(tokenId: string): boolean {
  return tokenId.length === 64 && isHexString(tokenId)
}

const LocalAttestTokenhandlerId = getAttestTokenHandlerId(ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID, CHAIN_ID_ALEPHIUM, ALEPHIUM_BRIDGE_GROUP_INDEX)
export async function createLocalTokenPool(
  signer: SignerProvider,
  nodeProvider: NodeProvider,
  payer: string,
  localTokenId: string,
  signedVaa: Uint8Array,
): Promise<string | undefined> {
  const tokenPoolId = getTokenPoolId(ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID, CHAIN_ID_ALEPHIUM, localTokenId, ALEPHIUM_BRIDGE_GROUP_INDEX)
  const exist = await contractExists(tokenPoolId, nodeProvider)
  if (exist) {
    return undefined
  }

  const result = await createLocalTokenPoolOnAlph(
    signer,
    LocalAttestTokenhandlerId,
    localTokenId,
    signedVaa,
    payer,
    MINIMAL_CONTRACT_DEPOSIT
  )
  return result.txId
}

export async function getAvailableBalances(provider: NodeProvider, address: string): Promise<Map<string, bigint>> {
  const rawBalance = await provider.addresses.getAddressesAddressBalance(address)
  const balances = new Map<string, bigint>()
  if (rawBalance === undefined) {
    return balances
  }
  const alphAmount = BigInt(rawBalance.balance) - BigInt(rawBalance.lockedBalance)
  balances.set(ALPH_TOKEN_ID, alphAmount)
  const tokens: node.Token[] = rawBalance.tokenBalances ?? []
  for (const token of tokens) {
    const locked = BigInt(rawBalance.lockedTokenBalances?.find((t) => t.id === token.id)?.amount ?? '0')
    const tokenAmount = BigInt(token.amount) - locked
    balances.set(token.id.toLowerCase(), tokenAmount)
  }
  return balances
}

export function hexToALPHAddress(hex: string): string {
  return base58.encode(Buffer.from(hex, 'hex'))
}

export async function getIsTxsCompletedAlph(tokenBridgeForChainId: string, sequences: bigint[]): Promise<boolean[]> {
  const contractState = await alephium_contracts.TokenBridgeForChain.at(addressFromContractId(tokenBridgeForChainId)).fetchState()
  const results: boolean[] = []
  for (const seq of sequences) {
    if (contractState.fields.start > seq) {
      results.push(await isSequenceExecuted(tokenBridgeForChainId, seq, ALEPHIUM_BRIDGE_GROUP_INDEX))
      continue
    }
    const distance = seq - contractState.fields.start
    if (distance >= BigInt(512)) {
      results.push(false)
    } else if (distance < BigInt(256)) {
      results.push(((contractState.fields.firstNext256 >> distance) & BigInt(1)) === BigInt(1))
    } else {
      results.push(((contractState.fields.secondNext256 >> (distance - BigInt(256))) & BigInt(1)) === BigInt(1))
    }
  }
  return results
}

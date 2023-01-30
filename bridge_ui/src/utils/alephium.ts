import {
  ALEPHIUM_BRIDGE_ADDRESS,
  ALEPHIUM_BRIDGE_GROUP_INDEX,
  ALEPHIUM_REMOTE_TOKEN_POOL_CODE_HASH,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  minimalAlphInContract
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
  TokenInfo,
  ALPHTokenInfo,
  getLocalTokenInfo
} from 'alephium-wormhole-sdk';
import {
  NodeProvider,
  node,
  addressFromContractId,
  groupOfAddress,
  ALPH_TOKEN_ID,
  isHexString,
  SignerProvider
} from '@alephium/web3';
import * as base58 from 'bs58'

const WormholeMessageEventIndex = 0

export class AlphTxInfo {
  blockHash: string
  blockHeight: number
  txId: string
  sequence: string
  targetChain: ChainId

  constructor(blockHash: string, blockHeight: number, txId: string, sequence: string, targetChain: ChainId) {
    this.blockHash = blockHash
    this.blockHeight = blockHeight
    this.txId = txId
    this.sequence = sequence
    this.targetChain = targetChain
  }
}

export async function waitTxConfirmed(provider: NodeProvider, txId: string): Promise<node.Confirmed> {
  const txStatus = await provider.transactions.getTransactionsStatus({txId: txId})
  if (isAlphTxConfirmed(txStatus)) {
    return txStatus as node.Confirmed
  }
  await new Promise(r => setTimeout(r, 10000))
  return waitTxConfirmed(provider, txId)
}

async function getTxInfo(provider: NodeProvider, txId: string, blockHash: string): Promise<AlphTxInfo> {
  const blockHeader = await provider.blockflow.getBlockflowHeadersBlockHash(blockHash)
  const events = await provider.events.getEventsTxIdTxid(txId, { group: blockHeader.chainFrom })
  const event = events.events.find((event) => event.contractAddress === ALEPHIUM_BRIDGE_ADDRESS)
  if (typeof event === 'undefined') {
    return Promise.reject('failed to get event for tx: ' + txId)
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
  return new AlphTxInfo(blockHash, blockHeader.height, txId, sequence, targetChain)
}

export async function waitTxConfirmedAndGetTxInfo(provider: NodeProvider, func: () => Promise<string>): Promise<AlphTxInfo> {
  const txId = await func()
  const confirmed = await waitTxConfirmed(provider, txId)
  return getTxInfo(provider, txId, confirmed.blockHash)
}

export async function getAlphTxInfoByTxId(provider: NodeProvider, txId: string): Promise<AlphTxInfo> {
  const confirmed = await waitTxConfirmed(provider, txId)
  return getTxInfo(provider, txId, confirmed.blockHash)
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

function getContractGroupIndex(contractId: string): number {
  if (contractId.length !== 64) {
    throw new Error('Invalid contract id length')
  }
  return parseInt(contractId.slice(-2), 16)
}

export async function getAlephiumTokenInfo(provider: NodeProvider, tokenId: string): Promise<TokenInfo | undefined> {
  if (tokenId === ALPH_TOKEN_ID) {
    return ALPHTokenInfo
  }

  const tokenAddress = addressFromContractId(tokenId)
  try {
    const groupIndex = getContractGroupIndex(tokenId)
    const state = await provider.contracts.getContractsAddressState(tokenAddress, { group: groupIndex })
    if (state.codeHash === ALEPHIUM_REMOTE_TOKEN_POOL_CODE_HASH) {
      return getRemoteTokenInfoFromContractState(state)
    }

    const exist = await localTokenPoolExists(provider, tokenId)
    return exist ? (await getLocalTokenInfo(provider, tokenId)) : undefined
  } catch (error) {
    console.log("failed to get alephium token info, error: " + error)
    return undefined
  }
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
  const groupIndex = getContractGroupIndex(tokenId)
  return provider
    .contracts
    .getContractsAddressState(tokenAddress, { group: groupIndex })
    .then(state => {
      if (state.codeHash === ALEPHIUM_REMOTE_TOKEN_POOL_CODE_HASH) {
        const tokenInfo = getRemoteTokenInfoFromContractState(state)
        const originalAsset = Buffer.from(tokenInfo.tokenId, 'hex')
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
    minimalAlphInContract
  )
  return result.txId
}

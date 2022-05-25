import {
    ALEPHIUM_EVENT_EMITTER_ADDRESS,
    ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
    ALEPHIUM_TOKEN_WRAPPER_CODE_HASH,
    WORMHOLE_ALEPHIUM_CONTRACT_SERVICE_HOST
} from "./consts";
import {
    ChainId,
    uint8ArrayToHex,
    getLocalTokenWrapperId,
    getRemoteTokenWrapperId,
    getTokenBridgeForChainId,
    toAlphContractAddress,
    parseSequenceFromLogAlph,
    CHAIN_ID_ALEPHIUM,
    WormholeWrappedInfo
} from '@certusone/wormhole-sdk';
import { NodeProvider, node } from 'alephium-web3';
import WalletConnectProvider from "alephium-walletconnect-provider";

const WormholeMessageEventIndex = 0

export class AlphTxInfo {
    blockHash: string
    blockHeight: number
    txId: string
    sequence: string

    constructor(blockHash: string, blockHeight: number, txId: string, sequence: string) {
        this.blockHash = blockHash
        this.blockHeight = blockHeight
        this.txId = txId
        this.sequence = sequence
    }
}

export async function waitTxConfirmed(provider: NodeProvider, txId: string): Promise<node.Confirmed> {
    const txStatus = await provider.transactions.getTransactionsStatus({txId: txId})
    if (isConfirmed(txStatus)) {
        return txStatus as node.Confirmed
    }
    await new Promise(r => setTimeout(r, 10000))
    return waitTxConfirmed(provider, txId)
}

async function getTxInfo(provider: NodeProvider, txId: string, blockHash: string): Promise<AlphTxInfo> {
    const blockHeader = await provider.blockflow.getBlockflowHeadersBlockHash(blockHash)
    const events = await provider.events.getEventsTxIdTxid(txId, {group: blockHeader.chainFrom})
    const event = events.events.find((event) => event.contractAddress === ALEPHIUM_EVENT_EMITTER_ADDRESS)
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
    return new AlphTxInfo(blockHash, blockHeader.height, txId, sequence)
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

function isConfirmed(txStatus: node.TxStatus): txStatus is node.Confirmed {
    return (txStatus as node.Confirmed).blockHash !== undefined
}

export interface RedeemInfo {
    remoteChainId: ChainId
    tokenId: string
    tokenChainId: ChainId
}

export function getRedeemInfo(signedVAA: Uint8Array): RedeemInfo {
    const length = signedVAA.length
    const remoteChainIdOffset = length - 176
    const remoteChainIdBytes = signedVAA.slice(remoteChainIdOffset, remoteChainIdOffset + 2)
    const remoteChainId = Buffer.from(remoteChainIdBytes).readUInt16BE(0)
    const tokenIdOffset = length - 100
    const tokenId = signedVAA.slice(tokenIdOffset, tokenIdOffset + 32)
    const tokenChainIdOffset = length - 68
    const tokenChainIdBytes = signedVAA.slice(tokenChainIdOffset, tokenChainIdOffset + 2)
    const tokenChainId = Buffer.from(tokenChainIdBytes).readUInt16BE(0)
    return {
        remoteChainId: remoteChainId as ChainId,
        tokenId: uint8ArrayToHex(tokenId),
        tokenChainId: tokenChainId as ChainId
    }
}

// TODO: replicated hosts
async function retry<T>(func: (host: string) => Promise<T>, retryAttempts?: number): Promise<T> {
  let result;
  let attempts = 0;
  while (!result) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      result = await func(WORMHOLE_ALEPHIUM_CONTRACT_SERVICE_HOST);
    } catch (e) {
      console.log("request error: " + e)
      if (typeof retryAttempts === "undefined") {
          throw e
      }
      if (attempts > retryAttempts) {
          throw e
      }
    }
  }
  return result;
}

export async function getLocalTokenWrapperIdWithRetry(
    localTokenId: string,
    remoteChainId: ChainId,
    retryAttempts?: number,
    extraGrpcOpts?: {}
): Promise<string> {
    const func = async (host: string) => {
        return getLocalTokenWrapperId(host, localTokenId, remoteChainId, extraGrpcOpts)
    }
    const response = await retry(func, retryAttempts)
    return uint8ArrayToHex(response.tokenWrapperId)
}

export async function getRemoteTokenWrapperIdWithRetry(
    remoteTokenId: string,
    retryAttempts?: number,
    extraGrpcOpts?: {}
): Promise<string> {
    const func = async (host: string) => {
        return getRemoteTokenWrapperId(host, remoteTokenId, extraGrpcOpts)
    }
    const response = await retry(func, retryAttempts)
    return uint8ArrayToHex(response.tokenWrapperId)
}

export async function getTokenBridgeForChainIdWithRetry(
    remoteChainId: ChainId,
    retryAttempts?: number,
    extraGrpcOpts?: {}
): Promise<string> {
    const func = async (host: string) => {
        return getTokenBridgeForChainId(host, remoteChainId, extraGrpcOpts)
    }
    const response = await retry(func, retryAttempts)
    return uint8ArrayToHex(response.tokenBridgeForChainId)
}

export class TokenInfo {
    decimals: number
    symbol: string
    name: string

    constructor(decimals: number, symbol: string, name: string) {
        this.decimals = decimals
        this.symbol = symbol
        this.name = name
    }
}

export async function getAlephiumTokenInfo(provider: NodeProvider, tokenId: string): Promise<TokenInfo> {
    const tokenAddress = toAlphContractAddress(tokenId)
    const group = await provider.addresses.getAddressesAddressGroup(tokenAddress)
    const state = await provider.contracts.getContractsAddressState(tokenAddress, {group: group.group})
    if (state.codeHash === ALEPHIUM_TOKEN_WRAPPER_CODE_HASH) {
        const symbol = (state.fields[6] as node.ValByteVec).value
        const name = (state.fields[7] as node.ValByteVec).value
        const decimals = parseInt((state.fields[8] as node.ValU256).value)
        return new TokenInfo(decimals, symbol, name)
    } else {
        const symbol = (state.fields[0] as node.ValByteVec).value
        const name = (state.fields[1] as node.ValByteVec).value
        const decimals = parseInt((state.fields[2] as node.ValU256).value)
        return new TokenInfo(decimals, symbol, name)
    }
}

export async function submitAlphScriptTx(
  provider: WalletConnectProvider,
  fromAddress: string,
  bytecode: string
) {
  return provider.signExecuteScriptTx({
    signerAddress: fromAddress,
    bytecode: bytecode,
    submitTx: true
  })
}

export async function getAlephiumTokenWrappedInfo(tokenId: string, provider: NodeProvider): Promise<WormholeWrappedInfo> {
  const tokenAddress = toAlphContractAddress(tokenId)
  const group = await provider.addresses.getAddressesAddressGroup(tokenAddress)
  return provider
    .contracts
    .getContractsAddressState(tokenAddress, {group: group.group})
    .then(response => {
      if (response.codeHash === ALEPHIUM_TOKEN_WRAPPER_CODE_HASH) {
        const originalAsset = Buffer.from((response.fields[4] as node.ValByteVec).value, 'hex')
        return {
          isWrapped: true,
          chainId: parseInt((response.fields[3] as node.ValU256).value) as ChainId,
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


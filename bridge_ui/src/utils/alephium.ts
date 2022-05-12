import { ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID, ALEPHIUM_TOKEN_WRAPPER_CODE_HASH, WORMHOLE_ALEPHIUM_CONTRACT_SERVICE_HOST } from "./consts";
import { ChainId, uint8ArrayToHex, getLocalTokenWrapperId, getRemoteTokenWrapperId, getTokenBridgeForChainId, toAlphContractAddress } from '@certusone/wormhole-sdk';
import { CliqueClient, SignScriptTxParams } from 'alephium-web3';
import { TxStatus, Confirmed, ValU256, ValByteVec } from 'alephium-web3/api/alephium';
import WalletConnectProvider from "alephium-walletconnect-provider";

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

export async function waitTxConfirmed(client: CliqueClient, txId: string): Promise<Confirmed> {
    const txStatus = await client.transactions.getTransactionsStatus({txId: txId})
    if (isConfirmed(txStatus.data)) {
        return txStatus.data as Confirmed
    }
    await new Promise(r => setTimeout(r, 10000))
    return waitTxConfirmed(client, txId)
}

async function parseSequenceFromLog(client: CliqueClient, txId: string, blockHash: string): Promise<AlphTxInfo> {
    const events = await client.events.getEventsTxScript({txId: txId})
    const event = events.data.events.find(event => event.txId === txId)
    if (typeof event === 'undefined') {
        return Promise.reject("failed to get event for tx: " + txId)
    }
    const blockHeader = await client.blockflow.getBlockflowHeadersBlockHash(blockHash)
    if (event.eventIndex !== 0) {
        return Promise.reject("invalid event index: " + event.eventIndex)
    }
    if (event.fields && event.fields.length !== 5) {
        return Promise.reject("invalid event, wormhole message has 5 fields")
    }
    const sender = event.fields[0]
    if (sender.type !== 'ByteVec') {
        return Promise.reject("invalid sender, expect ByteVec type, have: " + sender.type)
    }
    const senderContractId = (sender as ValByteVec).value
    if (senderContractId !== ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID) {
        return Promise.reject("invalid sender, expect token bridge contract id, have: " + senderContractId)
    }
    const field = event.fields[1]
    if (field.type !== 'U256') {
        return Promise.reject("invalid event, expect U256 type, have: " + field.type)
    }
    return new AlphTxInfo(event.blockHash, blockHeader.data.height, txId, (field as ValU256).value)
}

export async function waitTxConfirmedAndGetTxInfo(client: CliqueClient, func: () => Promise<string>): Promise<AlphTxInfo> {
    const txId = await func()
    const confirmed = await waitTxConfirmed(client, txId)
    return parseSequenceFromLog(client, txId, confirmed.blockHash)
}

export async function getAlphTxInfoByTxId(client: CliqueClient, txId: string): Promise<AlphTxInfo> {
    const confirmed = await waitTxConfirmed(client, txId)
    return parseSequenceFromLog(client, txId, confirmed.blockHash)
}

function isConfirmed(txStatus: TxStatus): txStatus is Confirmed {
    return (txStatus as Confirmed).blockHash !== undefined
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

export async function getAlephiumTokenInfo(client: CliqueClient, tokenId: string): Promise<TokenInfo> {
    const tokenAddress = toAlphContractAddress(tokenId)
    const group = await client.addresses.getAddressesAddressGroup(tokenAddress)
    const state = await client.contracts.getContractsAddressState(tokenAddress, {group: group.data.group})
    if (state.data.artifactId === ALEPHIUM_TOKEN_WRAPPER_CODE_HASH) {
        const decimals = parseInt((state.data.fields[6] as ValU256).value)
        const symbol = (state.data.fields[7] as ValByteVec).value
        const name = (state.data.fields[8] as ValByteVec).value
        return new TokenInfo(decimals, symbol, name)
    } else {
        const decimals = parseInt((state.data.fields[2] as ValU256).value)
        const symbol = (state.data.fields[0] as ValByteVec).value
        const name = (state.data.fields[1] as ValByteVec).value
        return new TokenInfo(decimals, symbol, name)
    }
}

export async function submitAlphScriptTx(
  provider: WalletConnectProvider,
  fromAddress: string,
  bytecode: string
) {
  const params: SignScriptTxParams = {
    signerAddress: fromAddress,
    bytecode: bytecode,
    submitTx: true
  }
  return provider.signScriptTx(params)
}

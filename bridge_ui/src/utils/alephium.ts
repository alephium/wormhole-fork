import { ALEPHIUM_EVENT_EMITTER_ADDRESS, WORMHOLE_ALEPHIUM_CONTRACT_SERVICE_HOST } from "./consts";
import { ChainId, uint8ArrayToHex, getLocalTokenWrapperId, getRemoteTokenWrapperId, getTokenBridgeForChainId } from '@certusone/wormhole-sdk';
import { CliqueClient } from 'alephium-web3';
import { TxStatus, Confirmed, Event, ValU256 } from 'alephium-web3/api/alephium';

const WormholeMessageEventIndex = 0

export class AlphTxInfo {
    blockHash: string
    blockHeight: number
    txId: string
    event: Event

    constructor(blockHash: string, blockHeight: number, event: Event) {
        this.blockHash = blockHash
        this.blockHeight = blockHeight
        this.txId = event.txId
        this.event = event
    }

    sequence(): string {
        if (this.event.eventIndex !== WormholeMessageEventIndex) {
            throw Error("try to get sequence from invalid event, event index: " + this.event.eventIndex)
        }
        return (this.event.fields[1] as ValU256).value
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

export async function waitTxConfirmedAndGetTxInfo(client: CliqueClient, func: () => Promise<string>): Promise<AlphTxInfo> {
    const startCount = await client.events.getEventsContractCurrentCount({contractAddress: ALEPHIUM_EVENT_EMITTER_ADDRESS})
    const txId = await func()
    const confirmed = await waitTxConfirmed(client, txId)
    const endCount = await client.events.getEventsContractCurrentCount({contractAddress: ALEPHIUM_EVENT_EMITTER_ADDRESS})
    const events = await client.events.getEventsContract({
        start: startCount.data,
        end: endCount.data,
        contractAddress: ALEPHIUM_EVENT_EMITTER_ADDRESS
    })
    const event = events.data.events.find(event => event.txId === txId)
    if (event !== undefined) {
        const blockHeader = await client.blockflow.getBlockflowHeadersBlockHash(confirmed.blockHash)
        return new AlphTxInfo(event.blockHash, blockHeader.data.height, event)
    }
    return Promise.reject("failed to get event for tx: " + txId)
}

export async function getAlphTxInfoByTxId(client: CliqueClient, txId: string): Promise<AlphTxInfo> {
    const batchSize = 100
    const confirmed = await waitTxConfirmed(client, txId)
    const currentEventCount = await client.events.getEventsContractCurrentCount({contractAddress: ALEPHIUM_EVENT_EMITTER_ADDRESS})
    let end = currentEventCount.data
    while (end > 0) {
        const start = (end >= batchSize) ? (end - batchSize) : 0
        const events = await client.events.getEventsContract({
            start: start,
            end: end,
            contractAddress: ALEPHIUM_EVENT_EMITTER_ADDRESS
        })
        const event = events.data.events.find(event => event.txId === txId)
        if (event !== undefined) {
            const blockHeader = await client.blockflow.getBlockflowHeadersBlockHash(confirmed.blockHash)
            return new AlphTxInfo(event.blockHash, blockHeader.data.height, event)
        }
        end = start
    }
    return Promise.reject("failed to get event for tx: " + txId)
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
    const remoteChainId = Buffer.from(remoteChainIdBytes).readUInt16BE()
    const tokenIdOffset = length - 100
    const tokenId = signedVAA.slice(tokenIdOffset, tokenIdOffset + 32)
    const tokenChainIdOffset = length - 68
    const tokenChainIdBytes = signedVAA.slice(tokenChainIdOffset, tokenChainIdOffset + 2)
    const tokenChainId = Buffer.from(tokenChainIdBytes).readUInt16BE()
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

import { ALEPHIUM_EVENT_EMITTER_ADDRESS, WORMHOLE_ALEPHIUM_CONTRACT_SERVICE_HOST } from "./consts";
import { ChainId, uint8ArrayToHex, getLocalTokenWrapperId, getRemoteTokenWrapperId } from '@certusone/wormhole-sdk';
import { CliqueClient } from 'alephium-web3';
import { TxStatus, Confirmed, Event, ValU256 } from 'alephium-web3/api/alephium';

export class AlphTxInfo {
    blockHash: string
    blockHeight: number
    event: Event

    constructor(blockHash: string, blockHeight: number, event: Event) {
        this.blockHash = blockHash
        this.blockHeight = blockHeight
        this.event = event
    }

    sequence(): number {
        return parseInt((this.event.fields[1] as ValU256).value)
    }
}

/*
async function getTxInfo(client: CliqueClient, txId: string, eventCount: number): Promise<AlphTxInfo> {
    const currentEventCount = await client.events.eventCount(ALEPHIUM_EVENT_EMITTER)
    const events = await client.events.getEvent(ALEPHIUM_EVENT_EMITTER, eventCount, currentEventCount - 1)
    const event = events.find(event => event.txId == txId)
    if (event) {
        return new AlphTxInfo(event.blockHash, event.blockHeight, event)
    }
    return Promise.reject("failed to get events for tx: " + txId)
}
*/

export async function getAlphConfirmedTxInfo(client: CliqueClient, txId: string): Promise<AlphTxInfo> {
    const txStatus = await client.transactions.getTransactionsStatus({txId: txId})
    if (isConfirmed(txStatus)) {
        // return getTxInfo
    }
    await new Promise(r => setTimeout(r, 10000))
    return getAlphConfirmedTxInfo(client, txId)
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

async function retry<T>(func: (host: string) => Promise<T>, retryAttempts?: number): Promise<T> {
  let result;
  let attempts = 0;
  while (!result) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      result = await func(WORMHOLE_ALEPHIUM_CONTRACT_SERVICE_HOST);
    } catch (e) {
      if (retryAttempts !== undefined && attempts > retryAttempts) {
        throw e;
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

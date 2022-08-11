import {
    ALEPHIUM_BRIDGE_ADDRESS,
    ALEPHIUM_REMOTE_TOKEN_POOL_CODE_HASH,
    ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
    ALEPHIUM_WRAPPED_ALPH_CONTRACT_ID
} from "./consts";
import {
    ChainId,
    toAlphContractAddress,
    parseSequenceFromLogAlph,
    CHAIN_ID_ALEPHIUM,
    WormholeWrappedInfo,
    parseTargetChainFromLogAlph,
    zeroPad
} from '@certusone/wormhole-sdk';
import { NodeProvider, node, subContractId, SignerProvider } from '@alephium/web3';

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
    if (isConfirmed(txStatus)) {
        return txStatus as node.Confirmed
    }
    await new Promise(r => setTimeout(r, 10000))
    return waitTxConfirmed(provider, txId)
}

async function getTxInfo(provider: NodeProvider, txId: string, blockHash: string): Promise<AlphTxInfo> {
    const blockHeader = await provider.blockflow.getBlockflowHeadersBlockHash(blockHash)
    const events = await provider.events.getEventsTxIdTxid(txId, {group: blockHeader.chainFrom})
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

function isConfirmed(txStatus: node.TxStatus): txStatus is node.Confirmed {
    return (txStatus as node.Confirmed).blockHash !== undefined
}

export function getEmitterChainId(signedVAA: Uint8Array): ChainId {
    const length = signedVAA.length
    const emitterChainIdOffset = length - 176
    const emitterChainIdBytes = signedVAA.slice(emitterChainIdOffset, emitterChainIdOffset + 2)
    const emitterChainId = Buffer.from(emitterChainIdBytes).readUInt16BE(0)
    return emitterChainId as ChainId
}

export function getTokenPoolId(tokenId: string, tokenChainId: ChainId): string {
    if (tokenId.length !== 64) {
        throw Error("invalid token id " + tokenId)
    }
    const path = zeroPad(Number(tokenChainId).toString(16), 2) + tokenId
    return subContractId(ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID, path)
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
    // TODO: get symbol and name from configs
    if (tokenId === ALEPHIUM_WRAPPED_ALPH_CONTRACT_ID) {
        return new TokenInfo(0, 'wrapped-alph', 'wrapped-alph')
    }

    const tokenAddress = toAlphContractAddress(tokenId)
    const group = await provider.addresses.getAddressesAddressGroup(tokenAddress)
    const state = await provider.contracts.getContractsAddressState(tokenAddress, {group: group.group})
    if (state.codeHash === ALEPHIUM_REMOTE_TOKEN_POOL_CODE_HASH) {
        const symbol = (state.fields[4] as node.ValByteVec).value
        const name = (state.fields[5] as node.ValByteVec).value
        const decimals = parseInt((state.fields[6] as node.ValU256).value)
        return new TokenInfo(decimals, symbol, name)
    } else {
        return new TokenInfo(0, 'token', 'token')
    }
}

export async function submitAlphScriptTx(
  provider: SignerProvider,
  fromAddress: string,
  bytecode: string,
  tokens?: node.Token[],
  attoAlphAmount?: string
) {
  return provider.signExecuteScriptTx({
    signerAddress: fromAddress,
    bytecode: bytecode,
    submitTx: true,
    tokens: tokens,
    attoAlphAmount: attoAlphAmount
  })
}

export async function contractExist(contractId: string, provider: NodeProvider): Promise<boolean> {
    const address = toAlphContractAddress(contractId)
    return provider
        .addresses
        .getAddressesAddressGroup(address)
        .then(_ => true)
        .catch(_ => false)
}

export async function getAlephiumTokenWrappedInfo(tokenId: string, provider: NodeProvider): Promise<WormholeWrappedInfo> {
  const tokenAddress = toAlphContractAddress(tokenId)
  const group = await provider.addresses.getAddressesAddressGroup(tokenAddress)
  return provider
    .contracts
    .getContractsAddressState(tokenAddress, {group: group.group})
    .then(response => {
      if (response.codeHash === ALEPHIUM_REMOTE_TOKEN_POOL_CODE_HASH) {
        const originalAsset = Buffer.from((response.fields[2] as node.ValByteVec).value, 'hex')
        return {
          isWrapped: true,
          chainId: parseInt((response.fields[1] as node.ValU256).value) as ChainId,
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


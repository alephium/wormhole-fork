import { ChainId, getSignedVAAWithRetry, zeroPad } from 'alephium-wormhole-sdk'
import { NodeHttpTransport } from '@improbable-eng/grpc-web-node-http-transport'
import { BridgeChain } from './bridge_chain'
import { AlephiumBridgeChain, createAlephium } from './alph'
import { createEth } from './eth'

export function assert(condition: boolean) {
  if (!condition) {
    console.trace('error')
    process.exit(-1)
  }
}

export async function sleep(seconds: number) {
  await new Promise((r) => setTimeout(r, seconds * 1000))
}

const GuardianHosts: string[] = ['http://127.0.0.1:7071']
export async function getSignedVAA(
  emitterChainId: ChainId,
  emitterAddress: string,
  targetChainId: ChainId,
  sequence: number
): Promise<Uint8Array> {
  const response = await getSignedVAAWithRetry(
    GuardianHosts,
    emitterChainId,
    emitterAddress,
    targetChainId,
    sequence.toString(),
    { transport: NodeHttpTransport() },
    1000,
    30
  )
  return response.vaaBytes
}

export function normalizeTokenId(tokenId: string): string {
  if (tokenId.length === 64) {
    return tokenId
  }
  if (tokenId.startsWith('0x') || tokenId.startsWith('0X')) {
    // ETH token address
    return zeroPad(tokenId.slice(2), 32)
  }
  if (tokenId.length === 40) {
    return zeroPad(tokenId, 32)
  }
  throw new Error(`invalid token id: ${tokenId}`)
}

type BridgeChains = {
  eth: BridgeChain
  alph: AlephiumBridgeChain
}

let bridgeChains: BridgeChains | undefined = undefined

export async function getBridgeChains(): Promise<BridgeChains> {
  if (bridgeChains !== undefined) {
    return bridgeChains
  }
  const alph = await createAlephium()
  const eth = await createEth()
  bridgeChains = { eth, alph }
  return bridgeChains
}

export function randomBigInt(max: bigint, normalizeFunc: (amount: bigint) => bigint): bigint {
  const length = max.toString().length
  let multiplier = ''
  while (multiplier.length < length) {
    multiplier += Math.random().toString().split('.')[1]
  }
  multiplier = multiplier.slice(0, length)
  const num = (max * BigInt(multiplier)) / 10n ** BigInt(length)
  const normalized = normalizeFunc(num)
  return normalized === 0n ? randomBigInt(max, normalizeFunc) : normalized
}

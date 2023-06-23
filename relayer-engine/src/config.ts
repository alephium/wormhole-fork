import { NetworkId, networkIds } from "@alephium/web3"
import { ChainId, coalesceChainName } from "@alephium/wormhole-sdk"
import { SUPPORTED_CHAINS } from "./utils"

export type Config = {
  networkId: NetworkId
  privateKeys: Partial<{ [k in ChainId]: string[] }>
  addresses: Partial<{ [k in ChainId]: string[] }>
  skipChains: ChainId[]
  spyUrl: string
  redisHost: string
  redisPort: number
  apiPort?: number
  metricsPort?: number
}

export function getConfig(): Config {
  if (!process.env.NETWORK) {
    throw new Error('the `NETWORK` env is not specified')
  }
  const networkId = process.env.NETWORK as string
  if (networkIds.find((n) => n === networkId) === undefined) {
    throw new Error(`invalid network id: ${networkId}`)
  }
  if (!process.env.SPY_URL) {
    throw new Error('the `SPY_URL` env is not specified')
  }
  if (!process.env.REDIS_URL) {
    throw new Error('the `REDIS_URL` env is not specified')
  }
  const parts = process.env.REDIS_URL.split(':')
  if (parts.length !== 2) {
    throw new Error(`invalid redis url ${process.env.REDIS_URL}`)
  }

  const allPrivateKeys: Partial<{ [k in ChainId]: string[] }> = {}
  const allAddresses: Partial<{ [k in ChainId]: string[] }> = {}
  const skipChains: ChainId[] = []
  for (const chainId of SUPPORTED_CHAINS) {
    const chainName = coalesceChainName(chainId).toUpperCase()
    const privateKeys = process.env[`${chainName}_PRIVATE_KEYS`]?.split(',') ?? []
    const addresses = process.env[`${chainName}_ADDRESSES`]?.split(',') ?? []
    if (privateKeys.length === 0) skipChains.push(chainId)
    allPrivateKeys[chainId] = privateKeys
    allAddresses[chainId] = addresses
  }

  return {
    networkId: networkId as NetworkId,
    privateKeys: allPrivateKeys,
    addresses: allAddresses,
    skipChains,
    spyUrl: process.env.SPY_URL,
    redisHost: parts[0],
    redisPort: parseInt(parts[1]),
    apiPort: process.env.API_PORT ? Number(process.env.API_PORT) : undefined,
    metricsPort: process.env.METRICS_PORT ? Number(process.env.METRICS_PORT): undefined
  }
}

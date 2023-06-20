import { NetworkId } from "@alephium/web3"
import { ChainId } from "alephium-wormhole-sdk"
import { Registry } from 'prom-client';

export type WalletConfig = {
  address: string
  tokens: string[]
}

export type TokenBalance = {
  symbol: string;
  tokenId: string;
  isNative: boolean;
  rawBalance: string;
  formattedBalance: string;
}

export type WalletBalancesByAddress = Record<string, TokenBalance[]>

export type WalletChainConfig = {
  chainId: ChainId
  wallets: WalletConfig[]
}

export type WalletMonitorConfig = {
  network: NetworkId
  chains: ChainWalletMonitorConfig[]
  metricsOption?: WalletMonitorMetricsOption
}

export type WalletMonitorMetricsOption = {
  enabled: boolean
  registry: Registry
  port?: number
  path?: string
  serve?: boolean
}

export type GetBalanceFn = (walletAddress: string, tokenIds: string[]) => Promise<TokenBalance[]>

export type ChainWalletMonitorConfig = {
  walletChainConfig: WalletChainConfig
  nodeUrl: string
  balancePollInterval: number
}

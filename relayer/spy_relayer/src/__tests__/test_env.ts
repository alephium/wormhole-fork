import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC, CHAIN_ID_ETH, isEVMChain } from 'alephium-wormhole-sdk'
import { config } from 'dotenv'
import { describe, test } from '@jest/globals'
import {
  AlephiumChainConfigInfo,
  EvmChainConfigInfo,
  getCommonEnvironment,
  getListenerEnvironment,
  getRelayerEnvironment
} from '../configureEnv'
import { ethers, providers } from 'ethers'

config({path: '.env.sample'})

function getTestEnv() {
  return {
    commonEnv: getCommonEnvironment(),
    listenerEnv: getListenerEnvironment(),
    relayerEnv: getRelayerEnvironment()
  }
}

export interface EvmChainConfig {
  chainInfo: EvmChainConfigInfo
  testToken: string
  provider: providers.JsonRpcProvider
  wallet: ethers.Wallet
  coreBridgeAddress: string
  tokenBridgeAddress: string
}

function loadEvmChain(chainId: ChainId): EvmChainConfig {
  if (!isEVMChain(chainId)) {
    throw new Error(`Invalid chain id ${chainId}, expect an evm chain`)
  }
  const chainInfo = testEnv.relayerEnv.supportedChains.find(c => c.chainId === chainId)! as EvmChainConfigInfo
  const privateKey = chainInfo.walletPrivateKeys![0] as string
  const provider = new ethers.providers.JsonRpcProvider(chainInfo.nodeUrl)
  return { 
    chainInfo: chainInfo,
    testToken: testEnv.relayerEnv.supportedTokens.filter((token) => token.chainId === chainId)![1].address,
    provider: provider,
    wallet: new ethers.Wallet(privateKey, provider),
    coreBridgeAddress: chainInfo.coreBridgeAddress,
    tokenBridgeAddress: chainInfo.tokenBridgeAddress
  }
}

export const testEnv = getTestEnv()
export const ETH_CHAIN = loadEvmChain(CHAIN_ID_ETH)
export const BSC_CHAIN = loadEvmChain(CHAIN_ID_BSC)

export const ALPH_CONFIG = testEnv.relayerEnv.supportedChains.find(c => c.chainId === CHAIN_ID_ALEPHIUM)! as AlephiumChainConfigInfo
export const ALPH_PRIVATE_KEY = ALPH_CONFIG.walletPrivateKeys![0] as string
export const ALPH_TOKEN_BRIDGE_ID = ALPH_CONFIG.tokenBridgeAddress

export const WORMHOLE_RPC_HOSTS = ['http://localhost:7071']
export const SPY_RELAY_URL = `http://localhost:${testEnv.listenerEnv.restPort}`

describe('', () => {
  test('', () => {
  })
})

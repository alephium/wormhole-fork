import { binToHex, contractIdFromAddress } from '@alephium/web3'
import { CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH } from 'alephium-wormhole-sdk'
import { config } from 'dotenv'
import { describe, test } from '@jest/globals'
import {
  AlephiumChainConfigInfo,
  EthereumChainConfigInfo,
  getCommonEnvironment,
  getListenerEnvironment,
  getRelayerEnvironment
} from '../configureEnv'

config({path: '.env.it'})

function getTestEnv() {
  return {
    commonEnv: getCommonEnvironment(),
    listenerEnv: getListenerEnvironment(),
    relayerEnv: getRelayerEnvironment()
  }
}


export const testEnv = getTestEnv()
export const ETH_CONFIG = testEnv.relayerEnv.supportedChains.find(c => c.chainId === CHAIN_ID_ETH)! as EthereumChainConfigInfo
export const ETH_CORE_BRIDGE_ADDRESS = ETH_CONFIG.coreBridgeAddress
export const ETH_TOKEN_BRIDGE_ADDRESS = ETH_CONFIG.tokenBridgeAddress
export const ETH_TOKENS = testEnv.listenerEnv.supportedTokens.filter(c => c.chainId === CHAIN_ID_ETH)!
export const ETH_NODE_URL = ETH_CONFIG.nodeUrl
export const ETH_PRIVATE_KEY = ETH_CONFIG.walletPrivateKeys![0] as string
export const TEST_ERC20 = ETH_TOKENS[0].address

export const ALPH_CONFIG = testEnv.relayerEnv.supportedChains.find(c => c.chainId === CHAIN_ID_ALEPHIUM)! as AlephiumChainConfigInfo
export const ALPH_TOKENS = testEnv.listenerEnv.supportedTokens.filter(c => c.chainId === CHAIN_ID_ALEPHIUM)!
export const ALPH_GROUP_INDEX = ALPH_CONFIG.groupIndex
export const ALPH_NODE_URL = ALPH_CONFIG.nodeUrl
export const ALPH_MNEMONIC = ALPH_CONFIG.walletPrivateKeys![0] as string
export const ALPH_TOKEN_BRIDGE_ID = ALPH_CONFIG.tokenBridgeAddress
export const ONE_ALPH = 10n ** 18n
export const ALPH_TEST_TOKEN_ID = binToHex(contractIdFromAddress(ALPH_TOKENS[0].address))

export const WORMHOLE_RPC_HOSTS = ['http://localhost:7071']
export const SPY_RELAY_URL = `http://localhost:${testEnv.listenerEnv.restPort}`

describe('', () => {
  test('', () => {
  })
})

import mainnetBridgeTokenList from '../tokens/mainnet.json'
import testnetBridgeTokenList from '../tokens/testnet.json'
import { BridgeToken } from './types'

export * from './types'

export const mainnetBridgeTokens = mainnetBridgeTokenList as BridgeToken[]
export const testnetBridgeTokens = testnetBridgeTokenList as BridgeToken[]
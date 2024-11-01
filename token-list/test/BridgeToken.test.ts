import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH, CHAIN_ID_BSC } from '@alephium/wormhole-sdk'
import { BridgeToken, mainnetBridgeTokens } from '../src'
import { BridgeChain, getBridgeChain, validateTokenMetadata } from '../utils'

describe('test bridge token list', () => {
  async function validateBridgeToken(network: 'testnet' | 'mainnet', tokenList: BridgeToken[]) {
    const bridgeChains: Partial<{ [k in ChainId]: BridgeChain }> = {}
    bridgeChains[CHAIN_ID_ALEPHIUM] = getBridgeChain(network, CHAIN_ID_ALEPHIUM)
    bridgeChains[CHAIN_ID_ETH] = getBridgeChain(network, CHAIN_ID_ETH)
    bridgeChains[CHAIN_ID_BSC] = getBridgeChain(network, CHAIN_ID_BSC)

    for (const bridgeToken of tokenList) {
      const tokenChain = bridgeChains[bridgeToken.tokenChainId as ChainId]!
      const targetChain = bridgeChains[bridgeToken.targetChainId as ChainId]!
      const originTokenId = tokenChain.validateAndNormalizeTokenId(bridgeToken.originTokenId)
      const expectedBridgeTokenId = await targetChain.getForeignAsset(tokenChain.chainId, originTokenId)
      if (expectedBridgeTokenId !== bridgeToken.bridgeTokenId) {
        throw new Error(`Invalid bridge token id, expected ${expectedBridgeTokenId}, have ${bridgeToken.bridgeTokenId}`)
      }

      const sourceTokenMetadata = await tokenChain.getTokenMetadata(bridgeToken.originTokenId)
      const targetTokenMetadata = await targetChain.getTokenMetadata(expectedBridgeTokenId)
      validateTokenMetadata(sourceTokenMetadata, targetTokenMetadata)
    }
  }

  test('testnet:bridge token list', async () => {
    await validateBridgeToken('mainnet', mainnetBridgeTokens)
  }, 90000)
})

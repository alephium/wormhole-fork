import { program } from 'commander'
import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC, CHAIN_ID_ETH } from '@alephium/wormhole-sdk'
import { BridgeChain, createAlephium, createEVM, TokenMetaData } from './utils'
import { BridgeToken, mainnetBridgeTokens, testnetBridgeTokens } from './src'
import path from 'path'
import fs from 'fs'

const supportedChainList = [CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH, CHAIN_ID_BSC]

function checkChainId(chainId: string): ChainId {
  const parsedChainId = parseInt(chainId)
  if ((supportedChainList as number[]).includes(parsedChainId)) {
    return parsedChainId as ChainId
  }
  throw new Error(`Invalid chain id: ${chainId}`)
}

function checkNetworkId(network: string): 'testnet' | 'mainnet' {
  if (network !== 'testnet' && network !== 'mainnet') {
    throw new Error(`Invalid network id: ${network}`)
  }
  return network as 'testnet' | 'mainnet'
}

function getBridgeChain(network: 'testnet' | 'mainnet', chainId: ChainId): BridgeChain {
  switch (chainId) {
    case CHAIN_ID_ALEPHIUM:
      return createAlephium(network)
    case CHAIN_ID_ETH:
    case CHAIN_ID_BSC:
      return createEVM(network, chainId)
  }
  throw new Error(`Invalid chain id: ${chainId}`)
}

function saveToTokenList(network: 'testnet' | 'mainnet', bridgeToken: BridgeToken) {
  const tokenList = network === 'testnet' ? testnetBridgeTokens : mainnetBridgeTokens
  const exists = tokenList.find((t) => t.tokenChainId === bridgeToken.tokenChainId &&
    t.originTokenId === bridgeToken.originTokenId &&
    t.targetChainId === bridgeToken.targetChainId
  ) !== undefined
  if (!exists) {
    const newTokenList = [...tokenList, bridgeToken]
    const filePath = path.join(process.cwd(), 'tokens', `${network}.json`)
    const content = JSON.stringify(newTokenList, null, 2)
    fs.writeFileSync(filePath, content)
  }
}

function validateMetadata(sourceMetadata: TokenMetaData, targetMetadata: TokenMetaData) {
  const targetNamePostfix = ' (Wormhole)'
  const expectedName = sourceMetadata.name + targetNamePostfix
  if (expectedName !== targetMetadata.name) {
    throw new Error(`Invalid bridge token name, expect ${expectedName}, have ${targetMetadata.name}`)
  }
  if (sourceMetadata.symbol !== targetMetadata.symbol) {
    throw new Error(`Invalid bridge token symbol, expect ${sourceMetadata.symbol}, have ${targetMetadata.symbol}`)
  }
  if (sourceMetadata.decimals !== targetMetadata.decimals) {
    throw new Error(`Invalid bridge token decimals, expect ${sourceMetadata.decimals}, have ${targetMetadata.decimals}`)
  }
}

program
  .command('add-token')
  .description('add bridge token to the token list')
  .requiredOption<'testnet' | 'mainnet'>('--network <network-id>', 'network id', checkNetworkId)
  .requiredOption<ChainId>('--tokenChainId <token-chain-id>', 'token chain id', checkChainId)
  .requiredOption('--tokenId <token-id>', 'token id')
  .requiredOption<ChainId>('--targetChainId <target-chain-id>', 'target chain id', checkChainId)
  .action(async (options) => {
    try {
      if (options.tokenChainId === options.targetChainId) {
        throw new Error('The tokenChainId cannot be the same as targetChainId')
      }
      const tokenChain = getBridgeChain(options.network, options.tokenChainId)
      const targetChain = getBridgeChain(options.network, options.targetChainId)
      const normalizedTokenId = tokenChain.validateAndNormalizeTokenId(options.tokenId)
      const bridgeTokenId = await targetChain.getForeignAsset(tokenChain.chainId, normalizedTokenId)
      if (bridgeTokenId === null) {
        throw new Error('Bridge token does not exists')
      }
      const sourceTokenMetadata = await tokenChain.getTokenMetadata(options.tokenId)
      const targetTokenMetadata = await targetChain.getTokenMetadata(bridgeTokenId)
      validateMetadata(sourceTokenMetadata, targetTokenMetadata)
      const bridgeToken: BridgeToken = {
        tokenChainId: tokenChain.chainId,
        originTokenId: options.tokenId,
        targetChainId: targetChain.chainId,
        bridgeTokenId: bridgeTokenId
      }
      console.log(`Found bridge token: ${JSON.stringify(bridgeToken)}`)
      saveToTokenList(options.network, bridgeToken)
    } catch (error) {
      program.error(`Failed to add bridge token, error: ${(error as Error).stack}`)
    }
  })

program.parseAsync(process.argv)

import { program } from 'commander'
import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC, CHAIN_ID_ETH } from '@alephium/wormhole-sdk'
import { getBridgeChain, validateTokenMetadata } from './utils'
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
      validateTokenMetadata(sourceTokenMetadata, targetTokenMetadata)
      const bridgeToken: BridgeToken = {
        name: sourceTokenMetadata.name,
        symbol: sourceTokenMetadata.symbol,
        decimals: sourceTokenMetadata.decimals,

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

program
  .command('list-token')
  .description('list bridge tokens')
  .requiredOption<'testnet' | 'mainnet'>('--network <network-id>', 'network id', checkNetworkId)
  .option<ChainId>('--tokenChainId <token-chain-id>', 'token chain id', checkChainId)
  .option<ChainId>('--targetChainId <target-chain-id>', 'target chain id', checkChainId)
  .action((options) => {
    const tokenList = options.network === 'testnet' ? testnetBridgeTokens : mainnetBridgeTokens
    const filtered = options.tokenChainId && options.targetChainId
      ? tokenList.filter((t) => t.tokenChainId === options.tokenChainId && t.targetChainId === options.targetChainId)
      : options.tokenChainId
      ? tokenList.filter((t) => t.tokenChainId === options.tokenChainId)
      : options.targetChainId
      ? tokenList.filter((t) => t.targetChainId === options.targetChainId)
      : tokenList
    console.log(JSON.stringify(filtered, null, 2))
  })

program.parseAsync(process.argv)

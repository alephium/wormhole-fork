import { default as alephiumTestnetContracts } from '../configs/alephium/testnet.json'
import { default as alephiumMainnetContracts } from '../configs/alephium/mainnet.json'
import { ALPH_TOKEN_ID, hexToBinUnsafe, isHexString, web3 } from '@alephium/web3'
import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC, CHAIN_ID_ETH, ethers_contracts, EVMChainId, getForeignAssetAlephium, isEVMChain } from '@alephium/wormhole-sdk'
import { default as ethTestnetContracts } from '../configs/ethereum/testnet.json'
import { default as ethMainnetContracts } from '../configs/ethereum/mainnet.json'
import { default as bscTestnetContracts } from '../configs/bsc/testnet.json'
import { default as bscMainnetContracts } from '../configs/bsc/mainnet.json'
import { ethers } from 'ethers'
import { getForeignAssetEth } from '@alephium/wormhole-sdk/lib/cjs/nft_bridge'
import { ALPH } from '@alephium/token-list'

export interface BridgeChain {
  chainId: ChainId

  validateAndNormalizeTokenId(tokenId: string): Uint8Array
  getForeignAsset(tokenChainId: ChainId, tokenId: Uint8Array): Promise<string | null>
  getTokenMetadata(tokenId: string): Promise<{ name: string, symbol: string, decimals: number }>
}

export type TokenMetaData = { name: string, symbol: string, decimals: number }

export function createAlephium(network: 'testnet' | 'mainnet'): BridgeChain {
  const deployments = network === 'testnet' ? alephiumTestnetContracts : alephiumMainnetContracts
  const nodeUrl = network === 'testnet' ? 'https://wallet-v20.testnet.alephium.org' : 'https://wallet-v20.mainnet.alephium.org'
  const textDecoder = new TextDecoder()
  web3.setCurrentNodeProvider(nodeUrl)

  const getForeignAsset = async (tokenChainId: ChainId, tokenId: Uint8Array): Promise<string | null> => {
    return await getForeignAssetAlephium(
      deployments.contracts.tokenBridge,
      web3.getCurrentNodeProvider(),
      tokenChainId,
      tokenId,
      deployments.groupIndex
    )
  }

  const getTokenMetadata = async (tokenId: string): Promise<TokenMetaData> => {
    if (tokenId === ALPH_TOKEN_ID) {
      return { name: ALPH.name, symbol: ALPH.symbol, decimals: ALPH.decimals }
    }
    const nodeProvider = web3.getCurrentNodeProvider()
    const result = await nodeProvider.fetchFungibleTokenMetaData(tokenId)
    const name = textDecoder.decode(hexToBinUnsafe(result.name))
    const symbol = textDecoder.decode(hexToBinUnsafe(result.symbol))
    return { name, symbol, decimals: result.decimals }
  }

  const validateAndNormalizeTokenId = (tokenId: string): Uint8Array => {
    if (isHexString(tokenId) && tokenId.length === 64) {
      return hexToBinUnsafe(tokenId)
    }
    throw new Error(`Invalid token id: ${tokenId}`)
  }

  return { chainId: CHAIN_ID_ALEPHIUM, validateAndNormalizeTokenId, getForeignAsset, getTokenMetadata }
}

function getEVMNodeUrl(chainId: EVMChainId, network: 'testnet' | 'mainnet'): string {
  switch (chainId) {
    case CHAIN_ID_ETH:
      return network === 'testnet' ? 'https://ethereum-goerli.publicnode.com' : 'https://ethereum.publicnode.com'
    case CHAIN_ID_BSC:
      return network === 'testnet' ? 'https://bsc-testnet.publicnode.com' : 'https://bsc.publicnode.com'
  }
  throw new Error(`Invalid chain id: ${chainId}`)
}

function getEVMDeployments(chainId: EVMChainId, network: 'testnet' | 'mainnet') {
  switch (chainId) {
    case CHAIN_ID_ETH:
      return network === 'testnet' ? ethTestnetContracts : ethMainnetContracts
    case CHAIN_ID_BSC:
      return network === 'testnet' ? bscTestnetContracts : bscMainnetContracts
  }
  throw new Error(`Invalid chain id: ${chainId}`)
}

export function createEVM(network: 'testnet' | 'mainnet', chainId: ChainId): BridgeChain {
  if (!isEVMChain(chainId)) {
    throw new Error(`Invalid evm chain id: ${chainId}`)
  }

  const deployments = getEVMDeployments(chainId, network)
  const nodeUrl = getEVMNodeUrl(chainId, network)
  const provider = new ethers.providers.JsonRpcProvider(nodeUrl)

  const validateAndNormalizeTokenId = (tokenId: string): Uint8Array => {
    const removePrefix = (tokenId.startsWith('0x') || tokenId.startsWith('0X')) ? tokenId.slice(2) : tokenId
    if (isHexString(removePrefix) && removePrefix.length === 40) {
      return hexToBinUnsafe(removePrefix.padStart(64, '0'))
    }
    throw new Error(`Invalid token id: ${tokenId}`)
  }

  const getForeignAsset = async (tokenChainId: ChainId, tokenId: Uint8Array): Promise<string | null> => {
    return await getForeignAssetEth(deployments.contracts.tokenBridge, provider, tokenChainId, tokenId)
  }

  const getTokenMetadata = async (tokenId: string): Promise<TokenMetaData> => {
    const token = ethers_contracts.ERC20__factory.connect(tokenId, provider)
    const name = await token.name()
    const symbol = await token.symbol()
    const decimals = await token.decimals()
    return { name, symbol, decimals }
  }

  return { chainId, validateAndNormalizeTokenId, getForeignAsset, getTokenMetadata }
}

export function getBridgeChain(network: 'testnet' | 'mainnet', chainId: ChainId): BridgeChain {
  switch (chainId) {
    case CHAIN_ID_ALEPHIUM:
      return createAlephium(network)
    case CHAIN_ID_ETH:
    case CHAIN_ID_BSC:
      return createEVM(network, chainId)
  }
  throw new Error(`Invalid chain id: ${chainId}`)
}

export function validateTokenMetadata(sourceMetadata: TokenMetaData, targetMetadata: TokenMetaData) {
  const targetNamePostfix = ' (AlphBridge)'
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

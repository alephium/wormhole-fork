import { CHAIN_ID_ETH } from 'alephium-wormhole-sdk'
import { BridgeChain } from './bridge_chain'
import { createEvmChain, EvmChainConfig } from './evm'
import { default as ethDevnetConfig } from '../../configs/ethereum/devnet.json'

export async function createEth(): Promise<BridgeChain> {
  const config: EvmChainConfig = {
    chainId: CHAIN_ID_ETH,
    contracts: ethDevnetConfig.contracts,
    privateKey: ethDevnetConfig.privateKey,
    tokenBridgeEmitterAddress: ethDevnetConfig.tokenBridgeEmitterAddress,
    nodeUrl: 'http://' + ethDevnetConfig.nodeUrl
  }
  return await createEvmChain(config)
}

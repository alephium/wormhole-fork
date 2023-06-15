import { CHAIN_ID_BSC } from 'alephium-wormhole-sdk'
import { BridgeChain } from './bridge_chain'
import { createEvmChain, EvmChainConfig } from './evm'
import { default as bscDevnetConfig } from '../../configs/bsc/devnet.json'

export async function createBsc(): Promise<BridgeChain> {
  const config: EvmChainConfig = {
    chainId: CHAIN_ID_BSC,
    contracts: bscDevnetConfig.contracts,
    privateKey: bscDevnetConfig.privateKey,
    tokenBridgeEmitterAddress: bscDevnetConfig.tokenBridgeEmitterAddress,
    nodeUrl: 'http://' + bscDevnetConfig.nodeUrl
  }
  return await createEvmChain(config)
}

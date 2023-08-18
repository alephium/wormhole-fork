import { ChainId } from '@alephium/wormhole-sdk'

export interface BridgeToken {
  tokenChainId: ChainId
  originTokenId: string
  targetChainId: ChainId
  bridgeTokenId: string
}
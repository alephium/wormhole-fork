import { ChainId } from '@alephium/wormhole-sdk'

export interface BridgeToken {
  symbol: string
  name: string
  decimals: number

  tokenChainId: ChainId
  originTokenId: string
  targetChainId: ChainId
  bridgeTokenId: string
}
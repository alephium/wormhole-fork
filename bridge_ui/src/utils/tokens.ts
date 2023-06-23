import bscIcon from "../icons/bsc.svg";
import ethIcon from "../icons/eth.svg";
import alephiumIcon from "../icons/alephium.svg";
import { ChainId } from "@alephium/wormhole-sdk";
import { EXPLORER_API_SERVER_HOST } from "./consts";

export type RegisteredTokenInfo = {
  tokenAddress: string
  tokenChain: ChainId
  decimals: number
  symbol: string
  name: string
  nativeAddress: string
  logo?: string
}

export async function getRegisteredTokens(): Promise<RegisteredTokenInfo[]> {
  try {
    const response = await fetch(`${EXPLORER_API_SERVER_HOST}/api/stats/tokens`)
    if (!response.ok) {
      throw new Error(`Failed to get tokens, response status: ${response.status}`)
    }
    const tokenList = await response.json()
    if (!Array.isArray(tokenList)) {
      throw new Error(`Invalid response, expect a token list`)
    }
    return (tokenList as any[]).map((item) => {
      const symbol = (item['symbol'] as string).toUpperCase()
      return {
        tokenAddress: item['tokenAddress'],
        tokenChain: item['tokenChain'],
        decimals: item['decimals'],
        symbol: symbol,
        name: item['name'],
        nativeAddress: item['nativeAddress'],
        logo: symbol === 'ALPH' ? alephiumIcon : symbol === 'WETH' ? ethIcon : symbol === 'WBNB' ? bscIcon : undefined
      }
    })
  } catch (error) {
    console.log(error)
    return []
  }
}

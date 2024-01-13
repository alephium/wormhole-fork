import { TokenInfo } from '@alephium/token-list'
import { NodeProvider } from '@alephium/web3'
import { getLocalTokenInfo } from '@alephium/wormhole-sdk'
import { useEffect, useMemo, useState } from 'react'
import { DataWrapper } from '../store/helpers'
import { getAvailableBalances } from '../utils/alephium'
import { ALEPHIUM_TOKEN_LIST } from '../utils/consts'
import { useWallet } from '@alephium/web3-react'

export type AlphMetadata = TokenInfo & {
  balance?: bigint
}

const fetchAlphMetadata = async (nodeProvider: NodeProvider, tokenIds: string[], fetchBalance: boolean, walletAddress?: string) => {
  const output = new Map<string, AlphMetadata>()
  if (fetchBalance && walletAddress === undefined) {
    return output
  }
  const promises: Promise<TokenInfo>[] = []
  tokenIds.forEach((tokenId) => {
    const tokenInfo = ALEPHIUM_TOKEN_LIST.find((t) => t.id === tokenId)
    if (tokenInfo !== undefined) {
      promises.push(Promise.resolve(tokenInfo))
    } else {
      promises.push(getLocalTokenInfo(nodeProvider, tokenId))
    }
  });
  const resultsArray = await Promise.all(promises)
  tokenIds.forEach((address, index) => {
    output.set(address.toLowerCase(), resultsArray[index])
  })
  if (fetchBalance && walletAddress !== undefined) {
    const balances = await getAvailableBalances(nodeProvider, walletAddress)
    output.forEach((o) => o.balance = balances.get(o.id) ?? BigInt(0))
  }

  return output
}

function useAlphMetadata(tokenIds: string[], fetchBalance: boolean, walletAddress?: string): DataWrapper<Map<string, AlphMetadata>> {
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<Map<string, AlphMetadata> | null>(null)
  const alphWallet = useWallet()

  useEffect(() => {
    let cancelled = false
    if (tokenIds.length > 0 && alphWallet.connectionStatus === 'connected' && alphWallet.nodeProvider !== undefined) {
      setIsFetching(true)
      setError('')
      setData(null)
      fetchAlphMetadata(alphWallet.nodeProvider, tokenIds, fetchBalance, walletAddress).then(
        (results) => {
          if (!cancelled) {
            setData(results)
            setIsFetching(false)
          }
        },
        (error) => {
          if (!cancelled) {
            setError(`Could not retrieve contract metadata, error: ${error}`)
            setIsFetching(false)
          }
        }
      )
    }
    return () => {
      cancelled = true;
    }
  }, [tokenIds, walletAddress, fetchBalance, alphWallet])

  return useMemo(
    () => ({
      data,
      isFetching,
      error,
      receivedAt: null,
    }),
    [data, isFetching, error]
  )
}

export default useAlphMetadata;

import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_ALGORAND, CHAIN_ID_SOLANA, CHAIN_ID_TERRA, isEVMChain } from '@alephium/wormhole-sdk'
// import { TokenInfo } from "@solana/spl-token-registry"; // Removed to keep package size small, replaced below
import { TokenInfo } from '../utils/solana'
import { useMemo } from 'react'
import { DataWrapper, getEmptyDataWrapper } from '../store/helpers'
import { logoOverrides } from '../utils/consts'
import { Metadata } from '../utils/metaplex'
import useAlgoMetadata, { AlgoMetadata } from './useAlgoMetadata'
import useEvmMetadata, { EvmMetadata } from './useEvmMetadata'
import useMetaplexData from './useMetaplexData'
import useSolanaTokenMap from './useSolanaTokenMap'
import useAlphMetadata, { AlphMetadata } from './useAlephiumMetadata'

export type GenericMetadata = {
  symbol?: string
  logo?: string
  tokenName?: string
  decimals?: number
  balances?: bigint
  //TODO more items
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any
}

const constructSolanaMetadata = (
  addresses: string[],
  solanaTokenMap: DataWrapper<TokenInfo[]>,
  metaplexData: DataWrapper<Map<string, Metadata | undefined> | undefined>
) => {
  const isFetching = solanaTokenMap.isFetching || metaplexData?.isFetching
  const error = solanaTokenMap.error || metaplexData?.isFetching
  const receivedAt = solanaTokenMap.receivedAt && metaplexData?.receivedAt
  const data = new Map<string, GenericMetadata>()
  addresses.forEach((address) => {
    const metaplex = metaplexData?.data?.get(address)
    const tokenInfo = solanaTokenMap.data?.find((x) => x.address === address)
    //Both this and the token picker, at present, give priority to the tokenmap
    const obj = {
      symbol: metaplex?.data?.symbol || tokenInfo?.symbol || undefined,
      logo: tokenInfo?.logoURI || undefined, //TODO is URI on metaplex actually the logo? If not, where is it?
      tokenName: metaplex?.data?.name || tokenInfo?.name || undefined,
      decimals: tokenInfo?.decimals || undefined, //TODO decimals are actually on the mint, not the metaplex account.
      raw: metaplex
    }
    data.set(address, obj)
  })

  return {
    isFetching,
    error,
    receivedAt,
    data
  }
}

const constructEthMetadata = (addresses: string[], metadataMap: DataWrapper<Map<string, EvmMetadata> | null>) => {
  const isFetching = metadataMap.isFetching
  const error = metadataMap.error
  const receivedAt = metadataMap.receivedAt
  const data = new Map<string, GenericMetadata>()
  addresses.forEach((address) => {
    const meta = metadataMap.data?.get(address)
    const obj = {
      symbol: meta?.symbol || undefined,
      logo: logoOverrides.get(address) || meta?.logo || undefined,
      tokenName: meta?.tokenName || undefined,
      decimals: meta?.decimals,
      balances: meta?.balance
    }
    data.set(address, obj)
  })

  return {
    isFetching,
    error,
    receivedAt,
    data
  }
}

const constructAlgoMetadata = (addresses: string[], metadataMap: DataWrapper<Map<string, AlgoMetadata> | null>) => {
  const isFetching = metadataMap.isFetching
  const error = metadataMap.error
  const receivedAt = metadataMap.receivedAt
  const data = new Map<string, GenericMetadata>()
  addresses.forEach((address) => {
    const meta = metadataMap.data?.get(address)
    const obj = {
      symbol: meta?.symbol || undefined,
      logo: logoOverrides.get(address) || undefined,
      tokenName: meta?.tokenName || undefined,
      decimals: meta?.decimals
    }
    data.set(address, obj)
  })

  return {
    isFetching,
    error,
    receivedAt,
    data
  }
}

const constructAlphMetadata = (addresses: string[], metadataMap: DataWrapper<Map<string, AlphMetadata> | null>) => {
  const isFetching = metadataMap.isFetching
  const error = metadataMap.error
  const receivedAt = metadataMap.receivedAt
  const data = new Map<string, GenericMetadata>()
  addresses.forEach((address) => {
    const meta = metadataMap.data?.get(address)
    const obj = {
      symbol: meta?.symbol || undefined,
      logo: meta?.logoURI || undefined,
      tokenName: meta?.name || undefined,
      decimals: meta?.decimals,
      balances: meta?.balance
    }
    data.set(address, obj)
  })

  return {
    isFetching,
    error,
    receivedAt,
    data
  }
}

export default function useMetadata(
  chainId: ChainId,
  addresses: string[],
  fetchBalance: boolean = false,
  walletAddress?: string
): DataWrapper<Map<string, GenericMetadata>> {
  const solanaTokenMap = useSolanaTokenMap()

  const solanaAddresses = useMemo(() => {
    return chainId === CHAIN_ID_SOLANA ? addresses : []
  }, [chainId, addresses])
  const ethereumAddresses = useMemo(() => {
    return isEVMChain(chainId) ? addresses : []
  }, [chainId, addresses])
  const algoAddresses = useMemo(() => {
    return chainId === CHAIN_ID_ALGORAND ? addresses : []
  }, [chainId, addresses])
  const alphTokenIds = useMemo(() => {
    return chainId === CHAIN_ID_ALEPHIUM ? addresses : []
  }, [chainId, addresses])

  const metaplexData = useMetaplexData(solanaAddresses)
  const ethMetadata = useEvmMetadata(ethereumAddresses, chainId, fetchBalance, walletAddress)
  const algoMetadata = useAlgoMetadata(algoAddresses)
  const alphMetadata = useAlphMetadata(alphTokenIds, fetchBalance, walletAddress)

  const output: DataWrapper<Map<string, GenericMetadata>> = useMemo(
    () =>
      chainId === CHAIN_ID_SOLANA
        ? constructSolanaMetadata(solanaAddresses, solanaTokenMap, metaplexData)
        : isEVMChain(chainId)
        ? constructEthMetadata(ethereumAddresses, ethMetadata)
        : chainId === CHAIN_ID_TERRA
        ? constructAlgoMetadata(algoAddresses, algoMetadata)
        : chainId === CHAIN_ID_ALEPHIUM
        ? constructAlphMetadata(alphTokenIds, alphMetadata)
        : getEmptyDataWrapper(),
    [
      chainId,
      solanaAddresses,
      solanaTokenMap,
      metaplexData,
      ethereumAddresses,
      ethMetadata,
      algoAddresses,
      algoMetadata,
      alphTokenIds,
      alphMetadata
    ]
  )

  return output
}

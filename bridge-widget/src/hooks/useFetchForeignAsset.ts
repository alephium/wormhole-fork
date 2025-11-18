import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  getForeignAssetAlephium,
  getForeignAssetEth,
  hexToUint8Array,
  isEVMChain,
  nativeToHexString
} from '@alephium/wormhole-sdk'
import { ethers } from 'ethers'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useEthereumProvider } from '../contexts/EthereumProviderContext'
import { DataWrapper } from '../store/helpers'
import { getConst, getEvmChainId, getTokenBridgeAddressForChain } from '../utils/consts'
import useIsWalletReady from './useIsWalletReady'
import { useWallet } from '@alephium/web3-react'
import { useTranslation } from 'react-i18next'

export type ForeignAssetInfo = {
  doesExist: boolean
  address: string | null
}

function useFetchForeignAsset(originChain: ChainId, originAsset: string, foreignChain: ChainId): DataWrapper<ForeignAssetInfo> {
  const { t } = useTranslation()
  const { provider, chainId: evmChainId } = useEthereumProvider()
  const { isReady } = useIsWalletReady(foreignChain, false)
  const correctEvmNetwork = getEvmChainId(foreignChain)
  const hasCorrectEvmNetwork = evmChainId === correctEvmNetwork
  const alphWallet = useWallet()

  const [assetAddress, setAssetAddress] = useState<string | null>(null)
  const [doesExist, setDoesExist] = useState<boolean | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const originAssetHex = useMemo(() => {
    try {
      return nativeToHexString(originAsset, originChain)
    } catch (e) {
      console.error(e)
      return null
    }
  }, [originAsset, originChain])
  const [previousArgs, setPreviousArgs] = useState<{
    originChain: ChainId
    originAsset: string
    foreignChain: ChainId
  } | null>(null)
  const argsEqual =
    !!previousArgs &&
    previousArgs.originChain === originChain &&
    previousArgs.originAsset === originAsset &&
    previousArgs.foreignChain === foreignChain
  const setArgs = useCallback(() => {
    setPreviousArgs({ foreignChain, originChain, originAsset })
  }, [foreignChain, originChain, originAsset])

  const argumentError = useMemo(
    () =>
      !originChain ||
      !originAsset ||
      !foreignChain ||
      !originAssetHex ||
      foreignChain === originChain ||
      (isEVMChain(foreignChain) && !isReady) ||
      (isEVMChain(foreignChain) && !hasCorrectEvmNetwork) ||
      argsEqual,
    [isReady, foreignChain, originAsset, originChain, hasCorrectEvmNetwork, originAssetHex, argsEqual]
  )

  useEffect(() => {
    if (!argsEqual) {
      setAssetAddress(null)
      setError('')
      setDoesExist(null)
      setPreviousArgs(null)
    }
    if (argumentError || !originAssetHex) {
      return
    }

    const cancelled = false
    setIsLoading(true)
    try {
      const getterFunc: () => Promise<string | bigint | null> = isEVMChain(foreignChain)
        ? () =>
            getForeignAssetEth(
              getTokenBridgeAddressForChain(foreignChain),
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              provider as any, //why does this typecheck work elsewhere?
              originChain,
              hexToUint8Array(originAssetHex)
            )
        : foreignChain === CHAIN_ID_ALEPHIUM
        ? () => {
            return getForeignAssetAlephium(
              getConst('ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID'),
              // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
              alphWallet?.nodeProvider!, // we have checked the wallet in `useIsWalletReady`
              originChain,
              hexToUint8Array(originAssetHex),
              getConst('ALEPHIUM_BRIDGE_GROUP_INDEX')
            )
          }
        : () => Promise.resolve(null)

      getterFunc()
        .then((result) => {
          if (!cancelled) {
            if (result && !(isEVMChain(foreignChain) && result === ethers.constants.AddressZero)) {
              setArgs()
              setDoesExist(true)
              setIsLoading(false)
              setAssetAddress(result.toString())
            } else {
              setArgs()
              setDoesExist(false)
              setIsLoading(false)
              setAssetAddress(null)
            }
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError(t('Could not retrieve the foreign asset.'))
            setIsLoading(false)
          }
        })
    } catch (e) {
      //This catch mostly just detects poorly formatted addresses
      if (!cancelled) {
        setError(t('Could not retrieve the foreign asset.'))
        setIsLoading(false)
        console.error(e)
      }
    }
  }, [argumentError, foreignChain, originAssetHex, originChain, provider, alphWallet, setArgs, argsEqual, t])

  const compoundError = useMemo(() => {
    return error ? error : ''
  }, [error]) //now swallows wallet errors

  const output: DataWrapper<ForeignAssetInfo> = useMemo(
    () => ({
      error: compoundError,
      isFetching: isLoading,
      data:
        (assetAddress !== null && assetAddress !== undefined) || (doesExist !== null && doesExist !== undefined)
          ? { address: assetAddress, doesExist: !!doesExist }
          : null,
      receivedAt: null
    }),
    [compoundError, isLoading, assetAddress, doesExist]
  )

  return output
}

export default useFetchForeignAsset

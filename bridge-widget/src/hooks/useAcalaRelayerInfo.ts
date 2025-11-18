import { ChainId, CHAIN_ID_ACALA, CHAIN_ID_KARURA } from '@alephium/wormhole-sdk'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { DataWrapper, errorDataWrapper, fetchDataWrapper, getEmptyDataWrapper, receiveDataWrapper } from '../store/helpers'
import { selectAcalaRelayerInfo } from '../store/selectors'
import { errorAcalaRelayerInfo, fetchAcalaRelayerInfo, receiveAcalaRelayerInfo, setAcalaRelayerInfo } from '../store/transferSlice'
import { getConst } from '../utils/consts'

export interface AcalaRelayerInfo {
  shouldRelay: boolean
  msg: string
}

export const useAcalaRelayerInfo = (
  targetChain: ChainId,
  vaaNormalizedAmount: string | undefined,
  originAsset: string | undefined,
  useStore: boolean = true
) => {
  // within flow, update the store
  const dispatch = useDispatch()
  // within recover, use internal state
  const [state, setState] = useState<DataWrapper<AcalaRelayerInfo>>(getEmptyDataWrapper())
  useEffect(() => {
    let cancelled = false
    if (
      !getConst('ACALA_RELAYER_URL') ||
      !targetChain ||
      (targetChain !== CHAIN_ID_ACALA && targetChain !== CHAIN_ID_KARURA) ||
      !vaaNormalizedAmount ||
      !originAsset
    ) {
      if (useStore) {
        dispatch(setAcalaRelayerInfo())
      } else {
        setState(getEmptyDataWrapper())
      }
      return
    }

    if (useStore) {
      dispatch(fetchAcalaRelayerInfo())
    } else {
      setState(fetchDataWrapper())
    }
    ;(async () => {
      try {
        const result = await axios.get(getConst('ACALA_SHOULD_RELAY_URL'), {
          params: {
            targetChain,
            originAsset,
            amount: vaaNormalizedAmount
          }
        })

        // console.log("check should relay: ", {
        //   targetChain,
        //   originAsset,
        //   amount: vaaNormalizedAmount,
        //   result: result.data?.shouldRelay,
        // });
        if (!cancelled) {
          if (useStore) {
            dispatch(receiveAcalaRelayerInfo(result.data))
          } else {
            setState(receiveDataWrapper(result.data))
          }
        }
      } catch (e) {
        if (!cancelled) {
          if (useStore) {
            dispatch(errorAcalaRelayerInfo('Failed to retrieve the Acala relayer info.'))
          } else {
            setState(errorDataWrapper('Failed to retrieve the Acala relayer info.'))
          }
          console.error(e)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [targetChain, vaaNormalizedAmount, originAsset, dispatch, useStore])
  const acalaRelayerInfoFromStore = useSelector(selectAcalaRelayerInfo)
  return useStore ? acalaRelayerInfoFromStore : state
}

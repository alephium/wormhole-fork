import { useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useHistory } from 'react-router-dom'
import { setSourceAsset, setSourceChain, setStep, setTargetChain } from '../../store/attestSlice'
import {
  selectAttestSignedVAAHex,
  selectTransferOriginAsset,
  selectTransferOriginChain,
  selectTransferTargetChain
} from '../../store/selectors'
import { ChainId, hexToNativeAssetString } from '@alephium/wormhole-sdk'
import BridgeWidgetButton from './BridgeWidgetButton'

interface RegisterNowButtonCoreProps {
  originChain: ChainId | undefined
  originAsset: string | undefined
  targetChain: ChainId
}

export const RegisterNowButtonCore = ({
  originChain,
  originAsset,
  targetChain
}: RegisterNowButtonCoreProps) => {
  const dispatch = useDispatch()
  const history = useHistory()
  // user might be in the middle of a different attest
  const signedVAAHex = useSelector(selectAttestSignedVAAHex)
  const canSwitch = originChain && originAsset && !signedVAAHex
  const handleClick = useCallback(() => {
    const nativeAsset = originChain && hexToNativeAssetString(originAsset, originChain)
    if (originChain && originAsset && nativeAsset && canSwitch) {
      dispatch(setSourceChain(originChain))
      dispatch(setSourceAsset(nativeAsset))
      dispatch(setTargetChain(targetChain))
      dispatch(setStep(2))
      history.push('/register')
    }
  }, [dispatch, canSwitch, originChain, originAsset, targetChain, history])
  if (!canSwitch) return null
  return (
    <BridgeWidgetButton
      variant="outlined"
      size="small"
      style={{ width: 'auto', boxShadow: 'none', padding: '0 20px' }}
      onClick={handleClick}
    >
      Register
    </BridgeWidgetButton>
  )
}

const RegisterNowButton2 = () => {
  const originChain = useSelector(selectTransferOriginChain)
  const originAsset = useSelector(selectTransferOriginAsset)
  const targetChain = useSelector(selectTransferTargetChain)
  return <RegisterNowButtonCore originChain={originChain} originAsset={originAsset} targetChain={targetChain} />
}

export default RegisterNowButton2

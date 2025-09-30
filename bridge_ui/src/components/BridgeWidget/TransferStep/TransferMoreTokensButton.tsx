import { useDispatch, useSelector } from 'react-redux'
import BridgeWidgetButton from '../BridgeWidgetButton'
import { useCallback } from 'react'
import { reset } from '../../../store/transferSlice'
import { selectTransferIsRedeemComplete, selectTransferIsRedeemedViaRelayer } from '../../../store/selectors'

const TransferMoreTokensButton = () => {
  const dispatch = useDispatch()

  const handleResetClick = useCallback(() => {
    dispatch(reset())
  }, [dispatch])

  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete)
  const isRedeemedViaRelayer = useSelector(selectTransferIsRedeemedViaRelayer)

  if (isRedeemComplete || isRedeemedViaRelayer) {
    return <BridgeWidgetButton onClick={handleResetClick}>Back to the homepage</BridgeWidgetButton>
  }

  return null
}

export default TransferMoreTokensButton

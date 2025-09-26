import { useDispatch, useSelector } from 'react-redux'
import BridgeWidgetButton from '../BridgeWidgetButton'
import { useCallback } from 'react'
import { reset } from '../../../store/transferSlice'
import { selectTransferIsRedeemComplete, selectTransferIsRedeemedViaRelayer } from '../../../store/selectors'
import { UseGetIsTransferCompletedReturnType } from '../../../hooks/useGetIsTransferCompleted'

const TransferMoreTokensButton = ({
  isTransferCompleted
}: Pick<UseGetIsTransferCompletedReturnType, 'isTransferCompleted'>) => {
  const dispatch = useDispatch()

  const handleResetClick = useCallback(() => {
    dispatch(reset())
  }, [dispatch])

  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete)
  const isRedeemedViaRelayer = useSelector(selectTransferIsRedeemedViaRelayer)

  if (isRedeemComplete || isRedeemedViaRelayer || isTransferCompleted) {
    return <BridgeWidgetButton onClick={handleResetClick}>Transfer more tokens!</BridgeWidgetButton>
  }

  return null
}

export default TransferMoreTokensButton

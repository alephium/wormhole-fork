import { useDispatch, useSelector } from 'react-redux'
import BridgeWidgetButton from '../BridgeWidgetButton'
import { useCallback } from 'react'
import { reset } from '../../../store/transferSlice'
import { selectTransferIsRedeemComplete, selectTransferIsRedeemedViaRelayer } from '../../../store/selectors'
import { TransferCompletionState } from '../../../hooks/useGetIsTransferCompleted'

interface TransferMoreTokensButtonProps {
  isTransferCompleted: TransferCompletionState
}

const TransferMoreTokensButton = ({ isTransferCompleted }: TransferMoreTokensButtonProps) => {
  const dispatch = useDispatch()

  const handleResetClick = useCallback(() => {
    dispatch(reset())
  }, [dispatch])

  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete)
  const isRedeemedViaRelayer = useSelector(selectTransferIsRedeemedViaRelayer)

  if (isRedeemComplete || isRedeemedViaRelayer || isTransferCompleted.isTransferCompleted) {
    return <BridgeWidgetButton onClick={handleResetClick}>Back to the homepage</BridgeWidgetButton>
  }

  return null
}

export default TransferMoreTokensButton

import { useCallback } from 'react'
import EnterDataStep from './EnterDataStep'
import ReviewStep from './ReviewStep'
import TransferStep from './TransferStep/TransferStep'
import { useDispatch, useSelector } from 'react-redux'
import { selectTransferActiveBridgeWidgetStep } from '../../store/selectors'
import { setBridgeWidgetStep } from '../../store/transferSlice'

const BridgeWidgetSteps = () => {
  const dispatch = useDispatch()
  const step = useSelector(selectTransferActiveBridgeWidgetStep)

  const goToEnterData = useCallback(() => dispatch(setBridgeWidgetStep(0)), [dispatch])
  const goToReview = useCallback(() => dispatch(setBridgeWidgetStep(1)), [dispatch])
  const goToTransferOverview = useCallback(() => dispatch(setBridgeWidgetStep(2)), [dispatch])

  return step === 0 ? (
    <EnterDataStep onNext={goToReview} />
  ) : step === 1 ? (
    <ReviewStep onNext={goToTransferOverview} onBack={goToEnterData} />
  ) : (
    <TransferStep />
  )
}

export default BridgeWidgetSteps

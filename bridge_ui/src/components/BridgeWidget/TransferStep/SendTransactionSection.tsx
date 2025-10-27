import { useDispatch, useSelector } from 'react-redux'
import {
  selectTransferIsSending,
  selectTransferIsWalletApproved,
  selectTransferTransferTx
} from '../../../store/selectors'
import { useCallback, useEffect } from 'react'
import { ThumbUp } from '@material-ui/icons'
import { CircularProgress } from '@material-ui/core'
import { GRAY, useWidgetStyles } from '../styles'
import SendTransactionSectionDetails from './SendTransactionSectionDetails'
import { setBridgeWidgetStep } from '../../../store/transferSlice'
import clsx from 'clsx'

const SendTransactionSection = () => {
  const classes = useWidgetStyles()

  const isWalletApproved = useSelector(selectTransferIsWalletApproved)
  const transferTx = useSelector(selectTransferTransferTx)
  const isSending = useSelector(selectTransferIsSending)
  const dispatch = useDispatch()
  const goToReview = useCallback(() => dispatch(setBridgeWidgetStep(1)), [dispatch])

  useEffect(() => {
    if (!isSending && !isWalletApproved && !transferTx) {
      goToReview()
    }
  }, [isSending, isWalletApproved, goToReview, transferTx])

  if (transferTx) {
    return <ConfirmedTransactionExpandableButton />
  }

  if (!transferTx && isWalletApproved) {
    return (
      <div className={classes.grayRoundedBox}>
        <div className={classes.sendStep}>
          <div className={classes.sendStepIcon}>
            <CircularProgress size={20} style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
          </div>
          <div className={classes.sendStepContent}>Waiting for the transaction to confirm.</div>
        </div>
      </div>
    )
  }

  if (!isWalletApproved) {
    return (
      <div className={classes.grayRoundedBox}>
        <div className={classes.sendStep}>
          <div className={classes.sendStepIcon}>
            <ThumbUp style={{ color: GRAY }} />
          </div>
          <div className={classes.sendStepContent}>
            Confirm the transaction in your wallet to send the tokens to the Alephium bridge.
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default SendTransactionSection

const ConfirmedTransactionExpandableButton = () => {
  const classes = useWidgetStyles()

  return (
    <div className={clsx(classes.grayRoundedBox, 'secondary')}>
      <SendTransactionSectionDetails />
    </div>
  )
}

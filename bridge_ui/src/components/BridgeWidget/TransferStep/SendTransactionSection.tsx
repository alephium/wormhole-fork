import { useDispatch, useSelector } from 'react-redux'
import {
  selectTransferIsSending,
  selectTransferIsWalletApproved,
  selectTransferTransferTx
} from '../../../store/selectors'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircleOutlineRounded, ThumbUp, UnfoldMoreOutlined } from '@material-ui/icons'
import { CircularProgress, IconButton } from '@material-ui/core'
import { GRAY, GREEN, useWidgetStyles } from '../styles'
import SendTransactionSectionDetails from './SendTransactionSectionDetails'
import { setBridgeWidgetStep } from '../../../store/transferSlice'

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
  const [isExpanded, setIsExpanded] = useState<boolean>(false)

  const handleExpandClick = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div className={classes.grayRoundedBox}>
      <div>
        <div className={classes.sendStep}>
          <div className={classes.sendStepIcon}>
            <CheckCircleOutlineRounded style={{ color: GREEN }} />
          </div>
          <div className={classes.spaceBetween}>
            <div className={classes.sendStepContentSuccess}>The transaction has confirmed!</div>
            <IconButton
              onClick={handleExpandClick}
              className={classes.expandButton}
              style={{
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease-in-out'
              }}
            >
              <UnfoldMoreOutlined />
            </IconButton>
          </div>
        </div>
        <div className={`${classes.expandableContainer} ${isExpanded ? classes.expanded : classes.collapsed}`}>
          <SendTransactionSectionDetails />
        </div>
      </div>
    </div>
  )
}

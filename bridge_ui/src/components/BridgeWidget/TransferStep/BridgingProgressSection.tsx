import { useSelector } from 'react-redux'
import { useEffect, useState } from 'react'
import { GRAY, GREEN, useWidgetStyles } from '../styles'
import useTransferSignedVAA from '../../../hooks/useTransferSignedVAA'
import { selectTransferTransferTx } from '../../../store/selectors'
import { selectTransferIsRedeemComplete } from '../../../store/selectors'
import { selectTransferIsRedeemedViaRelayer } from '../../../store/selectors'
import { selectTransferIsBlockFinalized } from '../../../store/selectors'
import { CircularProgress, IconButton } from '@material-ui/core'
import { CheckCircleOutlineRounded, UnfoldMoreOutlined } from '@material-ui/icons'
import BridgingProgressSectionDetails from './BridgingProgressSectionDetails'

const BridgingProgressSection = () => {
  const classes = useWidgetStyles()
  const [step, setStep] = useState<number>(1)
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const transferTx = useSelector(selectTransferTransferTx)
  const signedVAA = useTransferSignedVAA()
  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete)
  const isRedeemedViaRelayer = useSelector(selectTransferIsRedeemedViaRelayer)
  const isBlockFinalized = useSelector(selectTransferIsBlockFinalized)

  useEffect(() => {
    if (isRedeemComplete || isRedeemedViaRelayer) {
      setStep(4)

      const timeout = setTimeout(() => setStep(5), 8000)

      return () => clearTimeout(timeout)
    } else if (!!signedVAA) {
      setStep(3)
    } else if (isBlockFinalized) {
      setStep(2)
    }
  }, [isBlockFinalized, isRedeemComplete, isRedeemedViaRelayer, signedVAA])

  useEffect(() => {
    if (step === 5) {
      const timeout = setTimeout(() => setIsExpanded(false), 3000)
      return () => clearTimeout(timeout)
    }
  }, [step])

  if (!transferTx) return null

  const handleExpandClick = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div className={classes.grayRoundedBox}>
      <div>
        <div className={classes.sendStep}>
          <div className={classes.sendStepIcon}>
            {step === 5 ? (
              <CheckCircleOutlineRounded style={{ color: GREEN }} />
            ) : (
              <CircularProgress size={20} style={{ color: GRAY }} />
            )}
          </div>
          <div className={classes.spaceBetween}>
            <div className={classes.sendStepContentSuccess}>
              {step === 1 && 'Finalizing block... (1/4)'}
              {step === 2 && 'Waiting for proof... (2/4)'}
              {step === 3 && 'Redeeming proof... (3/4)'}
              {step === 4 && 'Sending tokens... (4/4)'}
              {step === 5 && 'Bridging completed!'}
            </div>
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
          <BridgingProgressSectionDetails />
        </div>
      </div>
    </div>
  )
}

export default BridgingProgressSection

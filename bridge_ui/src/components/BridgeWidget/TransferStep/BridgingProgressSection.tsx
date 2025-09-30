import { useSelector } from 'react-redux'
import { useEffect, useState } from 'react'
import { useWidgetStyles } from '../styles'
import useTransferSignedVAA from '../../../hooks/useTransferSignedVAA'
import { selectTransferRedeemTx, selectTransferTransferTx } from '../../../store/selectors'
import { selectTransferIsRedeemComplete } from '../../../store/selectors'
import { selectTransferIsRedeemedViaRelayer } from '../../../store/selectors'
import { selectTransferIsBlockFinalized } from '../../../store/selectors'
import { IconButton } from '@material-ui/core'
import { CheckCircleOutlineRounded, UnfoldLessOutlined, UnfoldMoreOutlined } from '@material-ui/icons'
import BridgingProgressSectionDetails from './BridgingProgressSectionDetails'
import OngoingBridgingBadge from './OngoingBridgingBadge'
import { COLORS } from '../../../muiTheme'

const BridgingProgressSection = () => {
  const classes = useWidgetStyles()
  const [step, setStep] = useState<number>(1)
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const [isIconPulsing, setIsIconPulsing] = useState<boolean>(false)
  const transferTx = useSelector(selectTransferTransferTx)
  const signedVAA = useTransferSignedVAA()
  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete)
  const isRedeemedViaRelayer = useSelector(selectTransferIsRedeemedViaRelayer)
  const isBlockFinalized = useSelector(selectTransferIsBlockFinalized)
  const redeemTx = useSelector(selectTransferRedeemTx)

  const isRedeemed = isRedeemComplete || isRedeemedViaRelayer || redeemTx

  useEffect(() => {
    if (isRedeemed) {
      setStep(4)

      const timeout = setTimeout(() => setStep(5), 5000)

      return () => clearTimeout(timeout)
    } else if (!!signedVAA) {
      setStep(3)
    } else if (isBlockFinalized) {
      setStep(2)
    }
  }, [isBlockFinalized, isRedeemed, signedVAA])

  useEffect(() => {
    if (step === 5) {
      const timeout = setTimeout(() => setIsExpanded(false), 3000)
      return () => clearTimeout(timeout)
    }
  }, [step])

  if (!transferTx) return null

  const handleExpandClick = () => {
    setIsExpanded(!isExpanded)

    // retrigger pulse animation on each click
    setIsIconPulsing(false)
    requestAnimationFrame(() => setIsIconPulsing(true))
  }

  return (
    <div className={classes.grayRoundedBox}>
      <div>
        <div className={classes.sendStep}>
          {step === 5 && (
            <div className={classes.sendStepIcon}>
              <CheckCircleOutlineRounded fontSize="small" style={{ color: COLORS.green }} />
            </div>
          )}
          <div className={classes.spaceBetween}>
            <OngoingBridgingBadge />
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
            >
              <span
                className={`${classes.expandIconWrapper} ${isIconPulsing ? classes.expandIconPulse : ''}`}
                onAnimationEnd={() => setIsIconPulsing(false)}
              >
                <UnfoldMoreOutlined
                  className={classes.expandIcon}
                  fontSize="small"
                  style={{
                    opacity: isExpanded ? 0 : 1,
                    filter: isExpanded ? 'blur(2px)' : 'blur(0)'
                  }}
                />
                <UnfoldLessOutlined
                  className={classes.expandIcon}
                  fontSize="small"
                  style={{
                    opacity: isExpanded ? 1 : 0,
                    filter: isExpanded ? 'blur(0)' : 'blur(2px)'
                  }}
                />
              </span>
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

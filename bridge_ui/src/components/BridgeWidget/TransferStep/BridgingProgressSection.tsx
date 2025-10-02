import { useSelector } from 'react-redux'
import { useEffect, useState } from 'react'
import { useWidgetStyles } from '../styles'
import useTransferSignedVAA from '../../../hooks/useTransferSignedVAA'
import { selectTransferHasSentTokens, selectTransferRedeemTx, selectTransferTransferTx } from '../../../store/selectors'
import { selectTransferIsRedeemComplete } from '../../../store/selectors'
import { selectTransferIsRedeemedViaRelayer } from '../../../store/selectors'
import { selectTransferIsBlockFinalized } from '../../../store/selectors'
import { IconButton } from '@material-ui/core'
import { CheckCircleOutlineRounded, UnfoldLessOutlined, UnfoldMoreOutlined } from '@material-ui/icons'
import BridgingProgressSectionDetails from './BridgingProgressSectionDetails'
import OngoingBridgingBadge from './OngoingBridgingBadge'
import { COLORS } from '../../../muiTheme'
import useManualRedeemNecessary from '../../../hooks/useManualRedeemNecessary'

const BridgingProgressSection = () => {
  const classes = useWidgetStyles()
  const [step, setStep] = useState<number>(1)
  const [isExpanded, setIsExpanded] = useState<boolean>(false)
  const transferTx = useSelector(selectTransferTransferTx)
  const signedVAA = useTransferSignedVAA()
  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete)
  const isRedeemedViaRelayer = useSelector(selectTransferIsRedeemedViaRelayer)
  const isBlockFinalized = useSelector(selectTransferIsBlockFinalized)
  const redeemTx = useSelector(selectTransferRedeemTx)
  const { manualRedeemToAlephiumRequired, manualRedeemToEvmRequired } = useManualRedeemNecessary()
  const isManualRedeemRequired = manualRedeemToAlephiumRequired || manualRedeemToEvmRequired
  const hasSentTokens = useSelector(selectTransferHasSentTokens)

  const isRedeemed = isRedeemComplete || isRedeemedViaRelayer || redeemTx

  useEffect(() => {
    if (hasSentTokens) {
      setStep(5)
    } else if (isRedeemed) {
      setStep(4)
    } else if (!!signedVAA) {
      setStep(3)
    } else if (isBlockFinalized) {
      setStep(2)
    }
  }, [hasSentTokens, isBlockFinalized, isRedeemed, signedVAA])

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
    <div className={classes.grayRoundedBox} style={{ backgroundColor: step === 5 ? COLORS.greenWithMoreTransparency : undefined }}>
      <div>
        <div className={classes.sendStep}>
          {step === 5 && (
            <div className={classes.sendStepIcon}>
                <CheckCircleOutlineRounded style={{ color: COLORS.green }} />
            </div>
          )}
          <div className={classes.spaceBetween}>
            {!hasSentTokens && <OngoingBridgingBadge />}
            {!isManualRedeemRequired && <div className={classes.sendStepContentSuccess} style={{ color: step === 5 ? COLORS.green : 'inherit' }}>
              {step === 1 && 'Finalizing block... (1/4)'}
              {step === 2 && 'Waiting for proof... (2/4)'}
              {step === 3 && 'Redeeming proof... (3/4)'}
              {step === 4 && 'Sending tokens... (4/4)'}
              {step === 5 && 'Bridging completed!'}
            </div>}
            <IconButton
              onClick={handleExpandClick}
              className={classes.expandButton}
            >
              <div className={classes.expandIconWrapper}>
                <UnfoldMoreOutlined
                  className={`${classes.expandIcon} ${!isExpanded ? classes.expandIconVisible : classes.expandIconHidden}`}
                />
                <UnfoldLessOutlined
                  className={`${classes.expandIcon} ${isExpanded ? classes.expandIconVisible : classes.expandIconHidden}`}
                />
              </div>
            </IconButton>
          </div>
        </div>
        <div className={`${classes.expandableContainer} ${isExpanded ? classes.expanded : classes.collapsed}`}>
          <BridgingProgressSectionDetails currentStep={step} />
        </div>
      </div>
    </div>
  )
}

export default BridgingProgressSection

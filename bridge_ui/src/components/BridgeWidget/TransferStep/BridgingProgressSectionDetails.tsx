import { CircularProgress, Typography } from '@material-ui/core'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectTransferIsBlockFinalized,
  selectTransferIsRedeemComplete,
  selectTransferIsRedeemedViaRelayer,
  selectTransferRecoverySourceTxId,
  selectTransferRedeemTx,
  selectTransferTargetChain
} from '../../../store/selectors'
import { GRAY, GREEN, useWidgetStyles } from '../styles'
import { RadioButtonUncheckedRounded } from '@material-ui/icons'
import { CheckCircleOutlineRounded } from '@material-ui/icons'
import useTransferSignedVAA from '../../../hooks/useTransferSignedVAA'
import FinalityProgress from './FinalityProgress'
import Divider from '../Divider'
import { useEffect } from 'react'
import SmartAddress from '../SmartAddress'
import ConfettiExplosion from 'react-confetti-explosion'
import { setHasSentTokens } from '../../../store/transferSlice'
import { COLORS } from '../../../muiTheme'
import { TransferCompletionState } from '../../../hooks/useGetIsTransferCompleted'
import useTransferOrRecoveryTxExists from '../useTransferOrRecoveryTxExists'

interface BridgingProgressSectionDetailsProps {
  currentStep: number
  isTransferCompleted: TransferCompletionState
}

const BridgingProgressSectionDetails = ({ currentStep, isTransferCompleted }: BridgingProgressSectionDetailsProps) => {
  const classes = useWidgetStyles()
  const dispatch = useDispatch()
  const userSentTransaction = useTransferOrRecoveryTxExists()
  const recoverySourceTx = useSelector(selectTransferRecoverySourceTxId)
  const signedVAA = useTransferSignedVAA()
  const isBlockFinalized = useSelector(selectTransferIsBlockFinalized)
  const redeemTx = useSelector(selectTransferRedeemTx)

  const targetChain = useSelector(selectTransferTargetChain)
  const { isTransferCompleted: isTransferCompletedFlag } = isTransferCompleted

  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete)
  const isRedeemedViaRelayer = useSelector(selectTransferIsRedeemedViaRelayer)

  const signedVAAExists = !!signedVAA || isTransferCompletedFlag
  const isFinalized = isBlockFinalized || isTransferCompletedFlag || redeemTx
  const isRedeemed = isTransferCompletedFlag || isRedeemComplete || isRedeemedViaRelayer || redeemTx

  useEffect(() => {
    if (isRedeemed) {
      if (recoverySourceTx) {
        dispatch(setHasSentTokens(true))
      } else {
        setTimeout(() => {
          dispatch(setHasSentTokens(true))
        }, 8000)
      }
    }
  }, [dispatch, isRedeemed, recoverySourceTx])

  return (
    <div className={classes.progressDetails}>
      <Divider />

      <FinalityProgress isActive={userSentTransaction} />

      <div className={classes.bridgingProgressRow} style={{ color: isFinalized ? 'inherit' : GRAY }}>
        <div className={classes.bridgingProgressIcon}>
          {currentStep > 2 ? (
            <CheckCircleOutlineRounded fontSize="small" style={{ color: GREEN }} />
          ) : currentStep === 2 ? (
            <CircularProgress size={18} style={{ color: COLORS.nearWhite }} />
          ) : (
            <RadioButtonUncheckedRounded fontSize="small" />
          )}
        </div>
        <div className={classes.bridgingProgressContent}>
          {currentStep > 2 ? (
            <Typography>VAA received!</Typography>
          ) : currentStep === 2 ? (
            <Typography>Waiting for VAA...</Typography>
          ) : (
            <Typography>Get verified action approval (VAA)</Typography>
          )}
        </div>
      </div>

      <div className={classes.bridgingProgressRow} style={{ color: signedVAAExists ? 'inherit' : GRAY }}>
        <div className={classes.bridgingProgressIcon}>
          {currentStep > 3 ? (
            <CheckCircleOutlineRounded fontSize="small" style={{ color: GREEN }} />
          ) : currentStep === 3 ? (
            <CircularProgress size={18} style={{ color: COLORS.nearWhite }} />
          ) : (
            <RadioButtonUncheckedRounded fontSize="small" />
          )}
        </div>
        <div className={classes.bridgingProgressContent}>
          {currentStep > 3 ? (
            <div className={classes.spaceBetween}>
              <Typography>VAA submitted!</Typography>
              {redeemTx && <SmartAddress chainId={targetChain} transactionAddress={redeemTx.id} />}
            </div>
          ) : currentStep === 3 ? (
            <Typography>Submitting VAA...</Typography>
          ) : (
            <Typography>Submit VAA</Typography>
          )}
        </div>
      </div>

      <div className={classes.bridgingProgressRow} style={{ color: isRedeemed ? 'inherit' : GRAY }}>
        <div className={classes.bridgingProgressIcon}>
          {currentStep > 4 ? (
            <div>
              <ConfettiExplosion force={0.4} duration={2200} particleCount={30} width={400} />
              <CheckCircleOutlineRounded fontSize="small" style={{ color: GREEN }} />
            </div>
          ) : currentStep === 4 ? (
            <CircularProgress size={18} style={{ color: COLORS.nearWhite }} />
          ) : (
            <RadioButtonUncheckedRounded fontSize="small" />
          )}
        </div>
        <div className={classes.bridgingProgressContent}>
          {currentStep > 4 ? (
            <Typography>Tokens sent to your wallet!</Typography>
          ) : currentStep === 4 ? (
            <Typography>Sending tokens to your wallet...</Typography>
          ) : (
            <Typography>Send tokens to your wallet</Typography>
          )}
        </div>
      </div>
    </div>
  )
}

export default BridgingProgressSectionDetails

import { CircularProgress, Typography } from '@material-ui/core'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectTransferHasSentTokens,
  selectTransferIsBlockFinalized,
  selectTransferIsRedeemComplete,
  selectTransferIsRedeemedViaRelayer,
  selectTransferRedeemTx,
  selectTransferTargetChain,
  selectTransferTransferTx,
  selectTransferUseRelayer
} from '../../../store/selectors'
import { GRAY, GREEN, useWidgetStyles } from '../styles'
import { RadioButtonUncheckedRounded } from '@material-ui/icons'
import { CheckCircleOutlineRounded } from '@material-ui/icons'
import useTransferSignedVAA from '../../../hooks/useTransferSignedVAA'
import FinalityProgress from './FinalityProgress'
import Divider from './Divider'
import { CHAIN_ID_ALEPHIUM } from '@alephium/wormhole-sdk'
import useGetIsTransferCompleted from '../../../hooks/useGetIsTransferCompleted'
import { useEffect } from 'react'
import { useSnackbar } from 'notistack'
import SmartAddress from '../SmartAddress'
import ConfettiExplosion from 'react-confetti-explosion'
import { setHasSentTokens } from '../../../store/transferSlice'
import { COLORS } from '../../../muiTheme'

interface BridgingProgressSectionDetailsProps {
  currentStep: number
}

const BridgingProgressSectionDetails = ({ currentStep }: BridgingProgressSectionDetailsProps) => {
  const classes = useWidgetStyles()
  const dispatch = useDispatch()
  const transferTx = useSelector(selectTransferTransferTx)
  const signedVAA = useTransferSignedVAA()
  const isBlockFinalized = useSelector(selectTransferIsBlockFinalized)
  const redeemTx = useSelector(selectTransferRedeemTx)
  const { enqueueSnackbar } = useSnackbar()

  const useRelayer = useSelector(selectTransferUseRelayer)
  const targetChain = useSelector(selectTransferTargetChain)
  const useAutoRelayer = targetChain === CHAIN_ID_ALEPHIUM
  const shouldCheckCompletion = useRelayer || useAutoRelayer
  const { isTransferCompleted, error: checkTransferCompletedError } = useGetIsTransferCompleted(
    !shouldCheckCompletion,
    shouldCheckCompletion ? 5000 : undefined
  )

  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete)
  const isRedeemedViaRelayer = useSelector(selectTransferIsRedeemedViaRelayer)
  const hasSentTokens = useSelector(selectTransferHasSentTokens)

  const signedVAAExists = !!signedVAA || isTransferCompleted
  const userSentTransaction = !!transferTx
  const isFinalized = isBlockFinalized || isTransferCompleted || redeemTx
  const isRedeemed = isTransferCompleted || isRedeemComplete || isRedeemedViaRelayer || redeemTx

  useEffect(() => {
    if (isRedeemed) {
      setTimeout(() => {
        dispatch(setHasSentTokens(true))
      }, 8000)
    }
  }, [dispatch, isRedeemed])

  useEffect(() => {
    if (checkTransferCompletedError) {
      enqueueSnackbar(checkTransferCompletedError, {
        variant: 'error',
        preventDuplicate: true
      })
    }
  }, [checkTransferCompletedError, enqueueSnackbar])

  return (
    <div className={classes.progressDetails}>
      <Divider />

      <FinalityProgress isActive={userSentTransaction} />

      <div className={classes.bridgingProgressRow} style={{ color: isFinalized ? 'inherit' : GRAY }}>
        <div className={classes.bridgingProgressIcon}>
          {currentStep > 2 ? <CheckCircleOutlineRounded fontSize="small" style={{ color: GREEN }} /> : currentStep === 2 ? <CircularProgress size={18} style={{ color: COLORS.nearWhite }} /> : <RadioButtonUncheckedRounded fontSize="small" />}
        </div>
        <div className={classes.bridgingProgressContent}>
          {currentStep > 2 ? <Typography>Received Action Approval!</Typography> : currentStep === 2 ? <Typography>Waiting for Action Approval...</Typography> : <Typography>Get Action Approval</Typography>}
        </div>
      </div>

      <div className={classes.bridgingProgressRow} style={{ color: signedVAAExists ? 'inherit' : GRAY }}>
        <div className={classes.bridgingProgressIcon}>
          {currentStep > 3 ? <CheckCircleOutlineRounded fontSize="small" style={{ color: GREEN }} /> : currentStep === 3 ? <CircularProgress size={18} style={{ color: COLORS.nearWhite }} /> : <RadioButtonUncheckedRounded fontSize="small" />}
        </div>
        <div className={classes.bridgingProgressContent}>
          {currentStep > 3 ? (
            <div className={classes.spaceBetween}>
              <Typography>Proof redeemed!</Typography>
              {redeemTx && <SmartAddress chainId={targetChain} transactionAddress={redeemTx.id} />}
            </div>
          ) : currentStep === 3 ? (
            <Typography>Redeeming proof...</Typography>
          ) : (
            <Typography>Get proof</Typography>
          )}
        </div>
      </div>

      <div className={classes.bridgingProgressRow} style={{ color: isRedeemed ? 'inherit' : GRAY }}>
        <div className={classes.bridgingProgressIcon}>
          {currentStep > 4 ? <div>
            <ConfettiExplosion force={0.4} duration={2200} particleCount={30} width={400} />
            <CheckCircleOutlineRounded fontSize="small" style={{ color: GREEN }} />
          </div> : currentStep === 4 ? <CircularProgress size={18} style={{ color: COLORS.nearWhite }} /> : <RadioButtonUncheckedRounded fontSize="small" />}
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

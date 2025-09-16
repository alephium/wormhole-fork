import { Typography } from '@material-ui/core'
import { useSelector } from 'react-redux'
import {
  selectTransferIsBlockFinalized,
  selectTransferIsRedeemComplete,
  selectTransferIsRedeemedViaRelayer,
  selectTransferRedeemTx,
  selectTransferTargetChain,
  selectTransferTransferTx,
  selectTransferUseRelayer
} from '../../../store/selectors'
import { selectTransferIsSendComplete } from '../../../store/selectors'
import { GRAY, GREEN, useWidgetStyles } from '../styles'
import { RadioButtonUncheckedRounded } from '@material-ui/icons'
import { CheckCircleOutlineRounded } from '@material-ui/icons'
import useTransferSignedVAA from '../../../hooks/useTransferSignedVAA'
import FinalityProgress from './FinalityProgress'
import Divider from './Divider'
import { CHAIN_ID_ALEPHIUM } from '@alephium/wormhole-sdk'
import useGetIsTransferCompleted from '../../../hooks/useGetIsTransferCompleted'
import { useEffect, useState } from 'react'
import { useSnackbar } from 'notistack'
import SmartAddress from '../SmartAddress'

const BridgingProgressSectionDetails = () => {
  const classes = useWidgetStyles()
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

  const [hasSentTokens, setHasSentTokens] = useState(false)

  useEffect(() => {
    if (isTransferCompleted) {
      setTimeout(() => {
        setHasSentTokens(true)
      }, 8000)
    }
  }, [isTransferCompleted])

  useEffect(() => {
    if (checkTransferCompletedError) {
      enqueueSnackbar(checkTransferCompletedError, {
        variant: 'error',
        preventDuplicate: true
      })
    }
  }, [checkTransferCompletedError, enqueueSnackbar])

  const signedVAAExists = !!signedVAA || isTransferCompleted
  const userSentTransaction = !!transferTx
  const isFinalized = isBlockFinalized || isTransferCompleted
  const isRedeemed = isTransferCompleted && (isRedeemComplete || isRedeemedViaRelayer)

  return (
    <div className={classes.progressDetails}>
      <Divider />

      <FinalityProgress isActive={userSentTransaction} />

      <div className={classes.bridgingProgressRow} style={{ color: isFinalized ? 'inherit' : GRAY }}>
        <div className={classes.bridgingProgressIcon}>
          {signedVAAExists ? <CheckCircleOutlineRounded style={{ color: GREEN }} /> : <RadioButtonUncheckedRounded />}
        </div>
        <div className={classes.bridgingProgressContent}>
          {signedVAAExists ? <Typography>Received proof!</Typography> : <Typography>Waiting for proof...</Typography>}
        </div>
      </div>

      <div className={classes.bridgingProgressRow} style={{ color: signedVAAExists ? 'inherit' : GRAY }}>
        <div className={classes.bridgingProgressIcon}>
          {isRedeemed ? <CheckCircleOutlineRounded style={{ color: GREEN }} /> : <RadioButtonUncheckedRounded />}
        </div>
        <div className={classes.bridgingProgressContent}>
          {isRedeemed ? (
            <div className={classes.spaceBetween}>
              <Typography>Proof redeemed!</Typography>
              {redeemTx && <SmartAddress chainId={targetChain} transactionAddress={redeemTx.id} />}
            </div>
          ) : (
            <Typography>Redeeming proof...</Typography>
          )}
        </div>
      </div>

      <div className={classes.bridgingProgressRow} style={{ color: isRedeemed ? 'inherit' : GRAY }}>
        <div className={classes.bridgingProgressIcon}>
          {hasSentTokens ? <CheckCircleOutlineRounded style={{ color: GREEN }} /> : <RadioButtonUncheckedRounded />}
        </div>
        <div className={classes.bridgingProgressContent}>
          {hasSentTokens ? (
            <Typography>Tokens sent to your wallet!</Typography>
          ) : (
            <Typography>Sending tokens to your wallet...</Typography>
          )}
        </div>
      </div>
    </div>
  )
}

export default BridgingProgressSectionDetails

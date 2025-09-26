import { Typography } from '@material-ui/core'
import { useSelector } from 'react-redux'
import {
  selectTransferIsBlockFinalized,
  selectTransferIsRedeemComplete,
  selectTransferIsRedeemedViaRelayer,
  selectTransferRedeemTx,
  selectTransferTargetChain,
  selectTransferTransferTx
} from '../../../store/selectors'
import { GRAY, GREEN, useWidgetStyles } from '../styles'
import { RadioButtonUncheckedRounded } from '@material-ui/icons'
import { CheckCircleOutlineRounded } from '@material-ui/icons'
import useTransferSignedVAA from '../../../hooks/useTransferSignedVAA'
import FinalityProgress from './FinalityProgress'
import Divider from './Divider'
import { UseGetIsTransferCompletedReturnType } from '../../../hooks/useGetIsTransferCompleted'
import { useEffect, useState } from 'react'
import SmartAddress from '../SmartAddress'

const BridgingProgressSectionDetails = ({
  isTransferCompleted
}: Pick<UseGetIsTransferCompletedReturnType, 'isTransferCompleted'>) => {
  const classes = useWidgetStyles()
  const transferTx = useSelector(selectTransferTransferTx)
  const signedVAA = useTransferSignedVAA()
  const isBlockFinalized = useSelector(selectTransferIsBlockFinalized)
  const redeemTx = useSelector(selectTransferRedeemTx)

  const targetChain = useSelector(selectTransferTargetChain)

  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete)
  const isRedeemedViaRelayer = useSelector(selectTransferIsRedeemedViaRelayer)

  const [hasSentTokens, setHasSentTokens] = useState(false)

  const signedVAAExists = !!signedVAA || isTransferCompleted
  const userSentTransaction = !!transferTx
  const isFinalized = isBlockFinalized || isTransferCompleted || redeemTx
  const isRedeemed = isTransferCompleted || isRedeemComplete || isRedeemedViaRelayer || redeemTx

  useEffect(() => {
    if (isRedeemed) {
      setTimeout(() => {
        setHasSentTokens(true)
      }, 8000)
    }
  }, [isRedeemed])

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

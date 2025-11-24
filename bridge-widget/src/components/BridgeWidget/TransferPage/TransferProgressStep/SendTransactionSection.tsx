import { useSelector } from 'react-redux'
import { selectTransferIsWalletApproved } from '../../../../store/selectors'
import { ThumbUp } from '@mui/icons-material'
import { CircularProgress } from '@mui/material'
import { GRAY, useWidgetStyles } from '../../styles'
import SendTransactionSectionDetails from './SendTransactionSectionDetails'
import clsx from 'clsx'
import useTransferOrRecoveryTxExists from '../../useTransferOrRecoveryTxExists'

const SendTransactionSection = () => {
  const { classes } = useWidgetStyles()
  const isWalletApproved = useSelector(selectTransferIsWalletApproved)
  const txExists = useTransferOrRecoveryTxExists()

  if (txExists) {
    return <ConfirmedTransactionExpandableButton />
  }

  if (!txExists && isWalletApproved) {
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
          <div className={classes.sendStepContent}>Confirm the transaction in your wallet to send the tokens to the Alephium bridge.</div>
        </div>
      </div>
    )
  }

  return null
}

export default SendTransactionSection

const ConfirmedTransactionExpandableButton = () => {
  const { classes } = useWidgetStyles()

  return (
    <div className={clsx(classes.grayRoundedBox, 'secondary')}>
      <SendTransactionSectionDetails />
    </div>
  )
}

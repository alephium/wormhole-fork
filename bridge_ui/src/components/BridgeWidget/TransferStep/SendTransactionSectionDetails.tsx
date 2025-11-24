import { Typography } from '@mui/material'
import SmartAddress from '../SmartAddress'
import SendingAddress from '../SendingAddress'
import SendingAmount from '../SendingAmount'
import { useSelector } from 'react-redux'
import { useWidgetStyles } from '../styles'
import { selectTransferRecoverySourceTxId, selectTransferSourceChain } from '../../../store/selectors'
import { selectTransferTransferTx } from '../../../store/selectors'
import { selectTransferSourceParsedTokenAccount } from '../../../store/selectors'
import Divider from '../Divider'
import useTransferOrRecoveryTxExists from '../useTransferOrRecoveryTxExists'

const SendTransactionSectionDetails = () => {
  const { classes } = useWidgetStyles()
  const sourceChain = useSelector(selectTransferSourceChain)
  const transferTx = useSelector(selectTransferTransferTx)
  const txExists = useTransferOrRecoveryTxExists()
  const recoverySourceTx = useSelector(selectTransferRecoverySourceTxId)
  const sourceParsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount)

  if (!txExists) return null

  const txId = transferTx ? transferTx.id : recoverySourceTx

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {sourceParsedTokenAccount && (
        <>
          <div className={classes.tokenIconSymbolContainer}>
            <div className={classes.spaceBetween}>
              <Typography>You sent</Typography>
              <div className={classes.networkAddressText}>
                <SendingAmount />
              </div>
            </div>
          </div>
          <Divider />
          <div className={classes.tokenIconSymbolContainer}>
            <div className={classes.spaceBetween}>
              <Typography>From</Typography>
              <div className={classes.networkAddressText}>
                <SendingAddress />
              </div>
            </div>
          </div>
        </>
      )}

      {!transferTx && (
        <div className={classes.tokenIconSymbolContainer}>
          <div className={classes.spaceBetween}>
            <Typography>Funds sent from</Typography>
            <div className={classes.networkAddressText}>
              <SendingAddress hideAddress />
            </div>
          </div>
        </div>
      )}

      <Divider />

      <div className={classes.tokenIconSymbolContainer}>
        <div className={classes.spaceBetween}>
          <Typography>To</Typography>
          <div className={classes.networkAddressText}>
            <Typography style={{ fontWeight: 'bold' }}>Alephium Bridge</Typography>
          </div>
        </div>
      </div>

      <Divider />

      <div className={classes.tokenIconSymbolContainer}>
        <div className={classes.spaceBetween}>
          <Typography>In transaction</Typography>
          <div className={classes.networkAddressText}>
            <SmartAddress
              chainId={sourceChain}
              transactionAddress={txId}
              pulse={!!transferTx}
              tooltipText={
                !!transferTx
                  ? 'Copy this transaction ID to resume your transfer in case you leave this page.'
                  : undefined
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SendTransactionSectionDetails

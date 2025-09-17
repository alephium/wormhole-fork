import { Typography } from '@material-ui/core'
import SmartAddress from '../SmartAddress'
import SendingAddress from '../SendingAddress'
import SendingAmount from '../SendingAmount'
import Divider from './Divider'
import { useSelector } from 'react-redux'
import { useWidgetStyles } from '../styles'
import { selectTransferSourceChain } from '../../../store/selectors'
import { selectTransferTransferTx } from '../../../store/selectors'
import { selectTransferSourceParsedTokenAccount } from '../../../store/selectors'

const SendTransactionSectionDetails = () => {
  const classes = useWidgetStyles()
  const sourceChain = useSelector(selectTransferSourceChain)
  const transferTx = useSelector(selectTransferTransferTx)
  const sourceParsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount)

  if (!transferTx) return null

  return (
    <div className={classes.progressDetails} style={{ gap: '10px' }}>
      <Divider />

      {sourceParsedTokenAccount && (
        <div className={classes.tokenIconSymbolContainer}>
          <div className={classes.spaceBetween}>
            <Typography style={{ fontWeight: 'bold' }}>You sent:</Typography>
            <div className={classes.networkAddressText}>
              <SendingAmount />
            </div>
          </div>
        </div>
      )}

      {sourceParsedTokenAccount && (
        <div className={classes.tokenIconSymbolContainer}>
          <div className={classes.spaceBetween}>
            <Typography style={{ fontWeight: 'bold' }}>from:</Typography>
            <div className={classes.networkAddressText}>
              <SendingAddress />
            </div>
          </div>
        </div>
      )}

      <div className={classes.tokenIconSymbolContainer}>
        <div className={classes.spaceBetween}>
          <Typography style={{ fontWeight: 'bold' }}>to:</Typography>
          <div className={classes.networkAddressText}>
            <Typography style={{ fontWeight: 'bold' }}>Alephium Bridge</Typography>
          </div>
        </div>
      </div>

      <div className={classes.tokenIconSymbolContainer}>
        <div className={classes.spaceBetween}>
          <Typography style={{ fontWeight: 'bold' }}>in transaction:</Typography>
          <div className={classes.networkAddressText}>
            <SmartAddress chainId={sourceChain} transactionAddress={transferTx.id} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SendTransactionSectionDetails

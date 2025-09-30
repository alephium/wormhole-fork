import { Typography } from '@material-ui/core'
import SmartAddress from '../SmartAddress'
import SendingAddress from '../SendingAddress'
import SendingAmount from '../SendingAmount'
import { useSelector } from 'react-redux'
import { useWidgetStyles } from '../styles'
import { selectTransferSourceChain } from '../../../store/selectors'
import { selectTransferTransferTx } from '../../../store/selectors'
import { selectTransferSourceParsedTokenAccount } from '../../../store/selectors'
import Divider from './Divider'

const SendTransactionSectionDetails = () => {
  const classes = useWidgetStyles()
  const sourceChain = useSelector(selectTransferSourceChain)
  const transferTx = useSelector(selectTransferTransferTx)
  const sourceParsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount)

  if (!transferTx) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {sourceParsedTokenAccount && (
        <div className={classes.tokenIconSymbolContainer}>
          <div className={classes.spaceBetween}>
            <Typography>You sent</Typography>
            <div className={classes.networkAddressText}>
              <SendingAmount />
            </div>
          </div>
        </div>
      )}

      <Divider />

      {sourceParsedTokenAccount && (
        <div className={classes.tokenIconSymbolContainer}>
          <div className={classes.spaceBetween}>
            <Typography>From</Typography>
            <div className={classes.networkAddressText}>
              <SendingAddress />
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
            <SmartAddress chainId={sourceChain} transactionAddress={transferTx.id} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default SendTransactionSectionDetails

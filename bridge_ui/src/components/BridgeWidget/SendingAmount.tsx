import { useSelector } from 'react-redux'
import {
  selectTransferAmount,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccount
} from '../../store/selectors'
import { makeStyles, Typography } from '@material-ui/core'
import SmartAddress from './SmartAddress'

const SendingAmount = () => {
  const classes = useStyles()
  const sourceAmount = useSelector(selectTransferAmount)
  const sourceChain = useSelector(selectTransferSourceChain)
  const sourceParsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
      <Typography style={{ fontWeight: 'bold' }}>{sourceAmount}</Typography>{' '}
      <SmartAddress chainId={sourceChain} parsedTokenAccount={sourceParsedTokenAccount} isAsset />
      {sourceParsedTokenAccount?.logo && (
        <img alt="" className={classes.networkIcon} src={sourceParsedTokenAccount?.logo} />
      )}
    </div>
  )
}

export default SendingAmount

const useStyles = makeStyles((theme) => ({
  networkIcon: {
    height: '1rem',
    width: '1rem'
  }
}))

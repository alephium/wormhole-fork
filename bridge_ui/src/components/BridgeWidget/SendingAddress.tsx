import { makeStyles, Typography } from '@material-ui/core'
import SmartAddress from './SmartAddress'
import { useMemo } from 'react'
import { selectSourceWalletAddress, selectTransferSourceChain } from '../../store/selectors'
import { useSelector } from 'react-redux'
import { CHAINS_BY_ID } from '../../utils/consts'

const GRAY = 'rgba(255, 255, 255, 0.5)'

const SendingAddress = ({ showIcon = false }: { showIcon?: boolean }) => {
  const classes = useStyles()
  const sourceChain = useSelector(selectTransferSourceChain)
  const sourceChainInfo = useMemo(() => CHAINS_BY_ID[sourceChain], [sourceChain])
  const sourceWalletAddress = useSelector(selectSourceWalletAddress)

  return (
    <>
      <Typography style={{ display: 'flex', alignItems: 'center', gap: '5px', color: GRAY }}>
        {showIcon && <img src={sourceChainInfo.logo} alt={sourceChainInfo.name} className={classes.networkIcon} />}
        {sourceChainInfo.name} address
      </Typography>
      <SmartAddress chainId={sourceChain} address={sourceWalletAddress} />
    </>
  )
}

export default SendingAddress

const useStyles = makeStyles((theme) => ({
  networkIcon: {
    height: '1rem',
    width: '1rem'
  }
}))

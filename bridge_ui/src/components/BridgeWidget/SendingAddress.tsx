import { makeStyles, Typography } from '@mui/material'
import SmartAddress from './SmartAddress'
import { useMemo } from 'react'
import { selectSourceWalletAddress, selectTransferSourceChain } from '../../store/selectors'
import { useSelector } from 'react-redux'
import { CHAINS_BY_ID } from '../../utils/consts'
import { GRAY } from './styles'
import { CHAIN_ID_BSC } from '@alephium/wormhole-sdk'

interface SendingAddressProps {
  showIcon?: boolean
  hideAddress?: boolean
}

const SendingAddress = ({ showIcon = false, hideAddress = false }: SendingAddressProps) => {
  const classes = useStyles()
  const sourceChain = useSelector(selectTransferSourceChain)
  const sourceChainInfo = useMemo(() => CHAINS_BY_ID[sourceChain], [sourceChain])
  const sourceWalletAddress = useSelector(selectSourceWalletAddress)

  const chainName = sourceChain === CHAIN_ID_BSC ? 'BSC' : sourceChainInfo.name
  const article = hideAddress ? (sourceChain === CHAIN_ID_BSC ? 'a ' : 'an ') : ''
  const fullChainName = `${article}${chainName} address`

  return (
    <>
      <Typography style={{ display: 'flex', alignItems: 'center', gap: '5px', color: GRAY }}>
        {showIcon && <img src={sourceChainInfo.logo} alt={sourceChainInfo.name} className={classes.networkIcon} />}
        {fullChainName}
      </Typography>
      {!hideAddress && <SmartAddress chainId={sourceChain} address={sourceWalletAddress} />}
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

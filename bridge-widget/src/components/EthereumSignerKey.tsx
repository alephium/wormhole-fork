import { useCallback, useState } from 'react'
import { Typography } from '@mui/material'
import { useTranslation } from 'react-i18next'
import { useEthereumProvider } from '../contexts/EthereumProviderContext'
import { shortenAddress } from '../utils/addresses'
import { ChainId } from '@alephium/wormhole-sdk'
import { getEvmChainId } from '../utils/consts'
import BridgeWidgetButton from './BridgeWidget/BridgeWidgetButton'
import EvmConnectWalletDialog from './EvmConnectWalletDialog'

const EthereumSignerKey = ({ chainId }: { chainId: ChainId }) => {
  const { t } = useTranslation()
  const { signerAddress, providerError, chainId: evmChainId } = useEthereumProvider()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const openDialog = useCallback(() => setIsDialogOpen(true), [])
  const closeDialog = useCallback(() => setIsDialogOpen(false), [])
  const isOnExpectedChain = getEvmChainId(chainId) === evmChainId
  const isConnected = !!signerAddress && isOnExpectedChain
  const truncatedAddress = signerAddress ? shortenAddress(signerAddress) : ''

  return (
    <>
      {isConnected ? (
        <Typography variant="body2" style={{ textAlign: 'right', opacity: 0.75 }}>
          {`${t('Connected wallets', { count: 1 })}: ${truncatedAddress}`}
        </Typography>
      ) : (
        <BridgeWidgetButton short onClick={openDialog}>
          {t('Connect wallet')}
        </BridgeWidgetButton>
      )}
      <EvmConnectWalletDialog isOpen={isDialogOpen} onClose={closeDialog} chainId={chainId} />
      {providerError ? (
        <Typography variant="body2" color="error">
          {providerError}
        </Typography>
      ) : null}
    </>
  )
}

export default EthereumSignerKey

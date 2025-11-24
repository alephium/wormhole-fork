import { AlephiumConnectButton } from '@alephium/web3-react'
import BridgeWidgetButton, { BridgeWidgetButtonProps } from './BridgeWidgetButton'
import { CHAIN_ID_ALEPHIUM, ChainId, isEVMChain } from '@alephium/wormhole-sdk'
import EvmConnectWalletDialog from '../EvmConnectWalletDialog'
import { useState } from 'react'

interface ConnectWalletButtonProps extends BridgeWidgetButtonProps {
  chainId?: ChainId | null
}

const ConnectWalletButton = ({ chainId, ...props }: ConnectWalletButtonProps) => {
  const [isEvmDialogOpen, setIsEvmDialogOpen] = useState(false)

  const isAlephium = chainId === CHAIN_ID_ALEPHIUM
  const isEvm = chainId && isEVMChain(chainId)

  if (isAlephium)
    return (
      <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
        {({ show: showAlephiumConnectModal }) => <BridgeWidgetButton onClick={showAlephiumConnectModal} {...props} />}
      </AlephiumConnectButton.Custom>
    )

  if (isEvm)
    return (
      <>
        <BridgeWidgetButton onClick={() => setIsEvmDialogOpen(true)} {...props} />
        <EvmConnectWalletDialog isOpen={isEvmDialogOpen} onClose={() => setIsEvmDialogOpen(false)} chainId={chainId} />
      </>
    )

  return null
}

export default ConnectWalletButton

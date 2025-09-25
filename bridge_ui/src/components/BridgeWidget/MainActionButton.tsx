import { useSelector } from 'react-redux'
import BridgeWidgetButton from './BridgeWidgetButton'
import { useTranslation } from 'react-i18next'
import {
  selectTransferIsSourceComplete,
  selectTransferIsTargetComplete,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccount
} from '../../store/selectors'
import { selectTransferTargetChain } from '../../store/selectors'
import useIsWalletReady from '../../hooks/useIsWalletReady'
import { useMemo, useState } from 'react'
import { CHAINS_BY_ID, getIsTransferDisabled } from '../../utils/consts'
import { CHAIN_ID_ALEPHIUM, ChainId, isEVMChain } from '@alephium/wormhole-sdk'
import EvmConnectWalletDialog from '../EvmConnectWalletDialog'
import { AlephiumConnectButton } from '@alephium/web3-react'
import { TokenIconSymbol } from './TokenPicker2'

interface MainActionButtonProps {
  onNext?: () => void
  onSelectToken?: () => void
}

const MainActionButton = ({ onNext, onSelectToken }: MainActionButtonProps) => {
  const { t } = useTranslation()
  const sourceChain = useSelector(selectTransferSourceChain)
  const targetChain = useSelector(selectTransferTargetChain)
  const { isReady: isSourceReady } = useIsWalletReady(sourceChain)
  const { isReady: isTargetReady } = useIsWalletReady(targetChain)
  const isSourceComplete = useSelector(selectTransferIsSourceComplete)
  const isTargetComplete = useSelector(selectTransferIsTargetComplete)
  const selectedToken = useSelector(selectTransferSourceParsedTokenAccount)
  const hasSelectedToken = !!selectedToken
  const isSourceTransferDisabled = useMemo(() => {
    return getIsTransferDisabled(sourceChain, true)
  }, [sourceChain])
  const isTargetTransferDisabled = useMemo(() => {
    return getIsTransferDisabled(targetChain, false)
  }, [targetChain])

  if (!isSourceReady) {
    return <ConnectButton chainId={sourceChain} />
  }

  if (!isTargetReady) {
    return <ConnectButton chainId={targetChain} />
  }

  const showSelectTokenButton = !!onSelectToken && !hasSelectedToken
  const showNextButton = !!onNext && hasSelectedToken

  if (!showSelectTokenButton && !showNextButton) {
    return null
  }

  const isNextDisabled =
    !isSourceComplete || !isTargetComplete || isSourceTransferDisabled || isTargetTransferDisabled

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      {showSelectTokenButton && (
        <BridgeWidgetButton onClick={onSelectToken}>
          {selectedToken ? <TokenIconSymbol account={selectedToken} /> : t('Select token')}
        </BridgeWidgetButton>
      )}

      {showNextButton && (
        <BridgeWidgetButton disabled={isNextDisabled} onClick={onNext}>
          {t('Next')}
        </BridgeWidgetButton>
      )}
    </div>
  )
}

export default MainActionButton

const ConnectButton = ({ chainId }: { chainId: ChainId }) => {
  const [isOpen, setIsOpen] = useState(false)

  const openDialog = () => {
    setIsOpen(true)
  }
  const closeDialog = () => {
    setIsOpen(false)
  }

  if (isEVMChain(chainId)) {
    return (
      <>
        <BridgeWidgetButton onClick={openDialog}>Connect {CHAINS_BY_ID[chainId].name} wallet</BridgeWidgetButton>
        <EvmConnectWalletDialog isOpen={isOpen} onClose={closeDialog} chainId={chainId} />
      </>
    )
  }

  if (chainId === CHAIN_ID_ALEPHIUM) {
    return (
      <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
        {({ show }) => {
          return <BridgeWidgetButton onClick={show}>Connect Alephium wallet</BridgeWidgetButton>
        }}
      </AlephiumConnectButton.Custom>
    )
  }

  return null
}

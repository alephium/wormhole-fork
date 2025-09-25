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
import { useEffect, useMemo, useState } from 'react'
import { CHAINS_BY_ID, getIsTransferDisabled } from '../../utils/consts'
import { CHAIN_ID_ALEPHIUM, ChainId, isEVMChain } from '@alephium/wormhole-sdk'
import EvmConnectWalletDialog from '../EvmConnectWalletDialog'
import { AlephiumConnectButton } from '@alephium/web3-react'
import { useWidgetStyles } from './styles'
import clsx from 'clsx'

interface MainActionButtonProps {
  onNext?: () => void
  onSelectToken?: () => void
}

const MainActionButton = ({ onNext, onSelectToken }: MainActionButtonProps) => {
  const { t } = useTranslation()
  const classes = useWidgetStyles()
  const sourceChain = useSelector(selectTransferSourceChain)
  const targetChain = useSelector(selectTransferTargetChain)
  const { isReady: isSourceReady } = useIsWalletReady(sourceChain)
  const { isReady: isTargetReady } = useIsWalletReady(targetChain)
  const isSourceComplete = useSelector(selectTransferIsSourceComplete)
  const isTargetComplete = useSelector(selectTransferIsTargetComplete)
  const selectedToken = useSelector(selectTransferSourceParsedTokenAccount)
  const hasSelectedToken = !!selectedToken
  const [isAnimating, setIsAnimating] = useState(false)
  const isSourceTransferDisabled = useMemo(() => {
    return getIsTransferDisabled(sourceChain, true)
  }, [sourceChain])
  const isTargetTransferDisabled = useMemo(() => {
    return getIsTransferDisabled(targetChain, false)
  }, [targetChain])

  const canSelectToken = typeof onSelectToken === 'function'
  const canProceed = typeof onNext === 'function'

  const isNextDisabled =
    !isSourceComplete || !isTargetComplete || isSourceTransferDisabled || isTargetTransferDisabled

  let variant: 'none' | 'connect-source' | 'connect-target' | 'select-token' | 'next-disabled' | 'next-enabled' = 'none'
  let buttonNode: JSX.Element | null = null

  if (!isSourceReady) {
    variant = 'connect-source'
    buttonNode = <ConnectButton chainId={sourceChain} />
  } else if (!isTargetReady) {
    variant = 'connect-target'
    buttonNode = <ConnectButton chainId={targetChain} />
  } else if (canSelectToken && !hasSelectedToken) {
    variant = 'select-token'
    buttonNode = <BridgeWidgetButton onClick={onSelectToken}>{t('Select token')}</BridgeWidgetButton>
  } else if (canProceed && hasSelectedToken) {
    variant = isNextDisabled ? 'next-disabled' : 'next-enabled'
    buttonNode = (
      <BridgeWidgetButton disabled={isNextDisabled} onClick={onNext}>
        {t('Next')}
      </BridgeWidgetButton>
    )
  }

  useEffect(() => {
    if (variant === 'none') return

    setIsAnimating(true)
    const timeout = window.setTimeout(() => {
      setIsAnimating(false)
    }, 260)

    return () => window.clearTimeout(timeout)
  }, [variant])

  if (!buttonNode) {
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      <div className={clsx(classes.pulseWrapper, isAnimating && classes.pulseWrapperAnimated)}>
        {buttonNode}
      </div>
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

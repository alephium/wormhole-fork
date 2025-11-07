import { useMemo } from 'react'
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import {
  selectTransferIsSourceComplete,
  selectTransferIsTargetComplete,
  selectTransferSourceChain,
  selectTransferActiveBridgeWidgetStep,
  selectTransferIsRedeemComplete,
  selectTransferIsRedeemedViaRelayer
} from '../../store/selectors'
import { selectTransferTargetChain } from '../../store/selectors'
import useIsWalletReady from '../../hooks/useIsWalletReady'
import { CHAINS_BY_ID, getIsTransferDisabled } from '../../utils/consts'
import { CHAIN_ID_ALEPHIUM, ChainId, isEVMChain } from '@alephium/wormhole-sdk'
import BridgeWidgetButton from './BridgeWidgetButton'
import { ActionConfig, ActionKey, useMainActionTransition } from './useMainActionTransition'
import SuccessPulse from './SuccessPulse'
import ConnectWalletButton from './ConnectWalletButton'

interface MainActionButtonProps {
  onNext?: () => void
}

const MainActionButton = ({ onNext }: MainActionButtonProps) => {
  const { classes } = useStyles()
  const { t } = useTranslation()

  const activeBridgeWidgetStep = useSelector(selectTransferActiveBridgeWidgetStep)
  const sourceChain = useSelector(selectTransferSourceChain)
  const targetChain = useSelector(selectTransferTargetChain)
  const isSourceComplete = useSelector(selectTransferIsSourceComplete)
  const isTargetComplete = useSelector(selectTransferIsTargetComplete)
  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete)
  const isRedeemedViaRelayer = useSelector(selectTransferIsRedeemedViaRelayer)

  const { isReady: isSourceReady } = useIsWalletReady(sourceChain)
  const { isReady: isTargetReady } = useIsWalletReady(targetChain)

  const isSourceTransferDisabled = getIsTransferDisabled(sourceChain, true)
  const isTargetTransferDisabled = getIsTransferDisabled(targetChain, false)

  const isNextDisabled = !isSourceComplete || !isTargetComplete || isSourceTransferDisabled || isTargetTransferDisabled

  const actionConfigs = useMemo<Record<ActionKey, ActionConfig>>(() => {
    const connectAction = (chainId: ChainId, fallbackLabel: string): ActionConfig => ({
      label: `Connect ${CHAINS_BY_ID[chainId]?.name ?? fallbackLabel} wallet`,
      disabled: !isEVMChain(chainId) && chainId !== CHAIN_ID_ALEPHIUM,
      chainId
    })

    return {
      'connect-source': connectAction(sourceChain, 'Source'),
      'connect-target': connectAction(targetChain, 'Target'),
      next: { label: t('Next'), disabled: !onNext || isNextDisabled }
    }
  }, [isNextDisabled, onNext, sourceChain, targetChain, t])

  const currentActionKey = useMemo<ActionKey>(() => {
    if (!isSourceReady) return 'connect-source'
    if (!isTargetReady) return 'connect-target'
    return 'next'
  }, [isSourceReady, isTargetReady])

  const currentAction = actionConfigs[currentActionKey]

  const { renderedAction, renderedActionKey, isButtonDisabled } = useMainActionTransition({
    currentActionKey,
    currentAction,
    actionConfigs
  })

  if (activeBridgeWidgetStep === 2 || isRedeemComplete || isRedeemedViaRelayer) {
    return null
  }

  const buttonContent = (
    <div className={classes.content}>
      <SuccessPulse hideIcon>{renderedAction.label}</SuccessPulse>
    </div>
  )

  return renderedActionKey === 'next' ? (
    <BridgeWidgetButton
      onClick={onNext}
      disabled={isButtonDisabled}
      className={classes.button}
      tone={!isNextDisabled ? 'primaryNext' : 'default'}
    >
      {buttonContent}
    </BridgeWidgetButton>
  ) : (
    <ConnectWalletButton chainId={currentAction.chainId} disabled={isButtonDisabled} className={classes.button}>
      {buttonContent}
    </ConnectWalletButton>
  )
}

export default MainActionButton

const useStyles = makeStyles()(() => ({
  button: {
    position: 'relative',
    overflow: 'hidden',
    padding: 0
  },
  content: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: '52px',
    width: '100%',
    overflow: 'hidden'
  }
}))

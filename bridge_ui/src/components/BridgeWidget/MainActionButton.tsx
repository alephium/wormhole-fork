import { useCallback, useMemo, useState } from 'react'
import { makeStyles } from '@material-ui/core'
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
import EvmConnectWalletDialog from '../EvmConnectWalletDialog'
import { AlephiumConnectButton } from '@alephium/web3-react'
import BridgeWidgetButton from './BridgeWidgetButton'
import { ActionConfig, ActionKey, useMainActionTransition } from './useMainActionTransition'
import SuccessPulse from './SuccessPulse'

interface MainActionButtonProps {
  onNext?: () => void
}

const MainActionButton = ({ onNext }: MainActionButtonProps) => {
  const classes = useStyles()
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

  const [evmChain, setEvmChain] = useState<ChainId | null>(null)

  const isSourceTransferDisabled = getIsTransferDisabled(sourceChain, true)
  const isTargetTransferDisabled = getIsTransferDisabled(targetChain, false)

  const isNextDisabled = !isSourceComplete || !isTargetComplete || isSourceTransferDisabled || isTargetTransferDisabled

  const actionConfigs = useMemo<Record<ActionKey, ActionConfig>>(() => {
    const connectAction = (chainId: ChainId, fallbackLabel: string): ActionConfig => ({
      label: `Connect ${CHAINS_BY_ID[chainId]?.name ?? fallbackLabel} wallet`,
      onClick: isEVMChain(chainId) ? () => setEvmChain(chainId) : undefined,
      disabled: !isEVMChain(chainId) && chainId !== CHAIN_ID_ALEPHIUM,
      chainId
    })

    return {
      'connect-source': connectAction(sourceChain, 'Source'),
      'connect-target': connectAction(targetChain, 'Target'),
      next: { label: t('Next'), onClick: onNext, disabled: !onNext || isNextDisabled }
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

  const handleClick = useCallback(() => {
    if (isButtonDisabled) return

    currentAction?.onClick?.()
  }, [currentAction, isButtonDisabled])

  if (activeBridgeWidgetStep === 2 || isRedeemComplete || isRedeemedViaRelayer) {
    return null
  }

  return (
    <>
      <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
        {({ show }) => (
          <BridgeWidgetButton
            onClick={currentAction.chainId === CHAIN_ID_ALEPHIUM ? show : handleClick}
            disabled={isButtonDisabled}
            className={classes.button}
            variant={'contained'}
            tone={renderedActionKey === 'next' && !isNextDisabled ? 'primaryNext' : 'default'}
          >
            <div className={classes.content}>
              <SuccessPulse hideIcon>{renderedAction.label}</SuccessPulse>
            </div>
          </BridgeWidgetButton>
        )}
      </AlephiumConnectButton.Custom>

      {evmChain !== null && <EvmConnectWalletDialog isOpen onClose={() => setEvmChain(null)} chainId={evmChain} />}
    </>
  )
}

export default MainActionButton

const useStyles = makeStyles(() => ({
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

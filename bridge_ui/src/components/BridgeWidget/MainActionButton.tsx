import { useCallback, useMemo, useState } from 'react'
import { makeStyles } from '@material-ui/core'
import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectTransferIsSourceComplete,
  selectTransferIsTargetComplete,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccount
} from '../../store/selectors'
import { selectTransferTargetChain } from '../../store/selectors'
import useIsWalletReady from '../../hooks/useIsWalletReady'
import { CHAINS_BY_ID, getIsTransferDisabled } from '../../utils/consts'
import { CHAIN_ID_ALEPHIUM, ChainId, isEVMChain } from '@alephium/wormhole-sdk'
import EvmConnectWalletDialog from '../EvmConnectWalletDialog'
import { useConnect } from '@alephium/web3-react'
import BridgeWidgetButton from './BridgeWidgetButton'
import { openTokenPickerDialog } from '../../store/transferSlice'
import { ActionConfig, ActionKey, useMainActionTransition } from './useMainActionTransition'
import SuccessPulse from './SuccessPulse'

interface MainActionButtonProps {
  onNext?: () => void
}

const MainActionButton = ({ onNext }: MainActionButtonProps) => {
  const classes = useStyles()
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { connect: connectAlephium } = useConnect()

  const sourceChain = useSelector(selectTransferSourceChain)
  const targetChain = useSelector(selectTransferTargetChain)
  const isSourceComplete = useSelector(selectTransferIsSourceComplete)
  const isTargetComplete = useSelector(selectTransferIsTargetComplete)
  const selectedToken = useSelector(selectTransferSourceParsedTokenAccount)

  const { isReady: isSourceReady } = useIsWalletReady(sourceChain)
  const { isReady: isTargetReady } = useIsWalletReady(targetChain)

  const [evmChain, setEvmChain] = useState<ChainId | null>(null)

  const hasSelectedToken = !!selectedToken
  const isSourceTransferDisabled = getIsTransferDisabled(sourceChain, true)
  const isTargetTransferDisabled = getIsTransferDisabled(targetChain, false)

  const isNextDisabled =
    !isSourceComplete || !isTargetComplete || isSourceTransferDisabled || isTargetTransferDisabled

  const handleOpenTokenPicker = useCallback(() => {
    dispatch(openTokenPickerDialog())
  }, [dispatch])

  const handleAlephiumConnect = useCallback(() => {
    connectAlephium()
  }, [connectAlephium])

  const handleEvmConnect = useCallback((chainId: ChainId) => {
    setEvmChain(chainId)
  }, [])

  const actionConfigs = useMemo<Record<ActionKey, ActionConfig>>(() => {
    const connectLabel = (chainId: ChainId, fallback: string) =>
      `Connect ${CHAINS_BY_ID[chainId]?.name ?? fallback} wallet`

    const connectAction = (chainId: ChainId, fallback: string): ActionConfig => {
      const label = connectLabel(chainId, fallback)
      if (isEVMChain(chainId)) return { label, onClick: () => handleEvmConnect(chainId), disabled: false }
      if (chainId === CHAIN_ID_ALEPHIUM) return { label, onClick: handleAlephiumConnect, disabled: false }
      return { label, disabled: true }
    }

    return {
      'connect-source': connectAction(sourceChain, 'Source'),
      'connect-target': connectAction(targetChain, 'Target'),
      'select-token': { label: t('Select token'), onClick: handleOpenTokenPicker, disabled: false },
      next: { label: t('Next'), onClick: onNext, disabled: !onNext || isNextDisabled }
    }
  }, [
    handleAlephiumConnect,
    handleEvmConnect,
    handleOpenTokenPicker,
    isNextDisabled,
    onNext,
    sourceChain,
    targetChain,
    t
  ])

  const currentActionKey = useMemo<ActionKey>(() => {
    if (!isSourceReady) return 'connect-source'
    if (!isTargetReady) return 'connect-target'
    if (!onNext || !hasSelectedToken) return 'select-token'
    return 'next'
  }, [hasSelectedToken, isSourceReady, isTargetReady, onNext])

  const currentAction = actionConfigs[currentActionKey]

  const { renderedAction, advanceToken, isButtonDisabled } = useMainActionTransition({
    currentActionKey,
    currentAction,
    actionConfigs
  })

  const handleClick = useCallback(() => {
    if (isButtonDisabled) return

    currentAction?.onClick?.()
  }, [currentAction, isButtonDisabled])

  return (
    <>
      <BridgeWidgetButton onClick={handleClick} disabled={isButtonDisabled} className={classes.button}>
        <div className={classes.content}>
          <SuccessPulse
            isActive
            activationKey={advanceToken}
            hideIcon
            contentClassName={classes.label}
          >
            {renderedAction.label}
          </SuccessPulse>
        </div>
      </BridgeWidgetButton>

      {evmChain !== null && (
        <EvmConnectWalletDialog isOpen onClose={() => setEvmChain(null)} chainId={evmChain} />
      )}
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
  },
  label: {
    fontSize: '16px',
    color: 'rgba(0, 0, 0, 0.92)',
    whiteSpace: 'nowrap'
  }
}))

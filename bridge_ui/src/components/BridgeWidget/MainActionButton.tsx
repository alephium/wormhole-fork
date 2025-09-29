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
import CheckCircleIcon from '@material-ui/icons/CheckCircle'
import { GREEN } from './styles'
import {
  ActionConfig,
  ActionKey,
  LABEL_ANIMATION_DURATION,
  useMainActionTransition
} from './useMainActionTransition'

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

  const { renderedAction, isShowingCheck, isLabelEntering, isButtonDisabled } = useMainActionTransition({
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
      <BridgeWidgetButton
        onClick={handleClick}
        disabled={isButtonDisabled}
        className={clsx(classes.button, { [classes.buttonChecking]: isShowingCheck })}
      >
        <div className={classes.content}>
          <span
            className={clsx(classes.label, {
              [classes.labelHidden]: isShowingCheck,
              [classes.labelEntering]: isLabelEntering
            })}
          >
            {renderedAction.label}
          </span>

          <div className={clsx(classes.check, { [classes.checkVisible]: isShowingCheck })}>
            <CheckCircleIcon className={classes.checkIcon} />
          </div>
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
    padding: 0,
    backgroundColor: '#fff',
    color: '#000',
    transition: 'background-color 420ms cubic-bezier(0.25, 1, 0.5, 1), color 320ms ease',
    '&:hover': {
      backgroundColor: '#fff'
    },
    '&.Mui-disabled': {
      backgroundColor: 'rgba(255, 255, 255, 0.65)',
      color: 'rgba(0, 0, 0, 0.35)'
    }
  },
  buttonChecking: {
    backgroundColor: GREEN,
    color: '#fff',
    '&:hover': {
      backgroundColor: GREEN
    },
    '&.Mui-disabled': {
      backgroundColor: GREEN,
      color: '#fff'
    }
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
    position: 'relative',
    fontSize: '16px',
    color: 'rgba(0, 0, 0, 0.92)',
    whiteSpace: 'nowrap',
    transition: 'transform 640ms cubic-bezier(0.25, 1, 0.5, 1), opacity 480ms ease, filter 480ms ease'
  },
  labelHidden: {
    opacity: 0,
    transform: 'scale(0.94)',
    filter: 'blur(6px)'
  },
  labelEntering: {
    animation: `$labelEnter ${LABEL_ANIMATION_DURATION}ms cubic-bezier(0.25, 1, 0.5, 1) forwards`
  },
  check: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transform: 'scale(0.8)',
    filter: 'blur(8px)',
    transition: 'transform 640ms cubic-bezier(0.25, 1, 0.5, 1), opacity 480ms ease, filter 480ms ease'
  },
  checkVisible: {
    opacity: 1,
    transform: 'scale(1)',
    filter: 'blur(0)'
  },
  checkIcon: {
    fontSize: '26px',
    color: '#fff'
  },
  '@keyframes labelEnter': {
    '0%': {
      opacity: 0,
      transform: 'scale(0.9)',
      filter: 'blur(8px)'
    },
    '50%': {
      opacity: 1,
      transform: 'scale(1.05)',
      filter: 'blur(0)'
    },
    '100%': {
      opacity: 1,
      transform: 'scale(1)',
      filter: 'blur(0)'
    }
  }
}))

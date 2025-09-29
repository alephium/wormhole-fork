import { makeStyles } from '@material-ui/core'
import CheckCircleIcon from '@material-ui/icons/CheckCircle'
import clsx from 'clsx'
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { COLORS } from '../../muiTheme'

interface SuccessPulseProps {
  isActive?: boolean
  activationKey?: unknown
  hideIcon?: boolean
  icon?: ReactNode
  className?: string
  iconClassName?: string
  contentClassName?: string
  children: ReactNode
}

const ICON_SIZE = 20
const SUCCESS_PULSE_ICON_DURATION = 680
const SUCCESS_PULSE_ENTER_DURATION = 400

const SuccessPulse = ({
  isActive,
  activationKey,
  hideIcon = false,
  icon,
  className,
  iconClassName,
  contentClassName,
  children
}: SuccessPulseProps) => {
  const classes = useStyles()

  const [isShowingIcon, setIsShowingIcon] = useState(false)
  const [isContentVisible, setIsContentVisible] = useState(() => hideIcon)
  const [canExpandContent, setCanExpandContent] = useState(() => hideIcon)
  const [isContentEntering, setIsContentEntering] = useState(false)
  const prevActiveRef = useRef(Boolean(isActive))
  const prevActivationKeyRef = useRef(activationKey)
  const isFirstRenderRef = useRef(true)
  const iconTimerRef = useRef<number | null>(null)
  const enterTimerRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (iconTimerRef.current !== null) {
      window.clearTimeout(iconTimerRef.current)
      iconTimerRef.current = null
    }
    if (enterTimerRef.current !== null) {
      window.clearTimeout(enterTimerRef.current)
      enterTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    const wasActive = prevActiveRef.current
    const active = Boolean(isActive)
    const previousKey = prevActivationKeyRef.current
    const keyChanged = activationKey !== undefined && activationKey !== previousKey
    const shouldTriggerOnFirstRender =
      isFirstRenderRef.current && activationKey !== undefined && active
    const shouldTrigger = shouldTriggerOnFirstRender || keyChanged || (isActive === true && !wasActive)

    if (shouldTrigger) {
      clearTimers()
      const shouldShowIcon = !hideIcon
      setIsShowingIcon(shouldShowIcon)
      setIsContentVisible(!shouldShowIcon)
      setCanExpandContent(!shouldShowIcon)
      setIsContentEntering(false)

      const startContent = () => {
        setIsShowingIcon(false)
        setIsContentVisible(true)
        setCanExpandContent(true)
        setIsContentEntering(true)

        enterTimerRef.current = window.setTimeout(() => {
          setIsContentEntering(false)
        }, SUCCESS_PULSE_ENTER_DURATION)
      }

      if (shouldShowIcon) {
        iconTimerRef.current = window.setTimeout(startContent, SUCCESS_PULSE_ICON_DURATION)
      } else {
        startContent()
      }
    } else if (isActive === false) {
      clearTimers()
      setIsShowingIcon(false)
      if (!hideIcon) {
        setIsContentVisible(false)
        setCanExpandContent(false)
      }
      setIsContentEntering(false)
    }

    prevActiveRef.current = active
    prevActivationKeyRef.current = activationKey
    isFirstRenderRef.current = false
    return clearTimers
  }, [activationKey, clearTimers, isActive, hideIcon])

  return (
    <span className={clsx(classes.root, className)}>
      {!hideIcon && (
        <span
          className={clsx(
            classes.icon,
            iconClassName,
            isShowingIcon && classes.iconVisible,
            isShowingIcon && classes.iconEntering
          )}
        >
          {icon ?? <CheckCircleIcon className={classes.iconDefault} htmlColor={COLORS.green} />}
        </span>
      )}
      <span
        className={clsx(
          classes.content,
          contentClassName,
          isContentVisible && classes.contentVisible,
          isContentEntering && classes.contentEntering,
          canExpandContent && classes.contentExpanded
        )}
      >
        {children}
      </span>
    </span>
  )
}

export default SuccessPulse

const useStyles = makeStyles(() => ({
  root: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: ICON_SIZE,
    minHeight: ICON_SIZE,
    overflow: 'visible'
  },
  icon: {
    position: 'absolute',
    width: ICON_SIZE,
    height: ICON_SIZE,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transform: 'scale(0.8)',
    filter: 'blur(8px)',
    transition: 'all 400ms cubic-bezier(0.25, 1, 0.5, 1)',
    zIndex: 1,
    pointerEvents: 'none',
    backgroundColor: COLORS.white,
    borderRadius: '100px'
  },
  iconVisible: {
    opacity: 1,
    transform: 'scale(1)',
    filter: 'blur(0)'
  },
  iconEntering: {
    animation: `$pulseEnter ${SUCCESS_PULSE_ENTER_DURATION}ms cubic-bezier(0.25, 1, 0.5, 1) forwards`
  },
  iconDefault: {
    fontSize: '20px'
  },
  content: {
    display: 'inline-flex',
    alignItems: 'center',
    position: 'relative',
    opacity: 0,
    maxWidth: 0,
    transform: 'scale(0.9)',
    filter: 'blur(8px)',
    transition:
      'all 600ms cubic-bezier(0.25, 1, 0.5, 1)',
    pointerEvents: 'auto'
  },
  contentVisible: {
    opacity: 1,
    transform: 'scale(1)',
    filter: 'blur(0)'
  },
  contentExpanded: {
    maxWidth: '1000px'
  },
  contentEntering: {
    animation: `$pulseEnter ${SUCCESS_PULSE_ENTER_DURATION}ms cubic-bezier(0.25, 1, 0.5, 1) forwards`
  },
  '@keyframes pulseEnter': {
    '0%': {
      transform: 'scale(0.92)',
      filter: 'blur(4px)'
    },
    '40%': {
      transform: 'scale(1.04)',
      filter: 'blur(0)'
    },
    '100%': {
      transform: 'scale(1)',
      filter: 'blur(0)'
    }
  }
}))

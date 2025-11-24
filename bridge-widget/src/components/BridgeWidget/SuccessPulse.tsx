import { makeStyles } from 'tss-react/mui'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import clsx from 'clsx'
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { COLORS } from '../../muiTheme'

interface SuccessPulseProps {
  hideIcon?: boolean
  icon?: ReactNode
  className?: string
  iconClassName?: string
  contentClassName?: string
  children: ReactNode
}

const ICON_SIZE = 20
const SUCCESS_PULSE_ICON_DURATION = 1100
const SUCCESS_PULSE_ENTER_DURATION = 900

const SuccessPulse = ({ hideIcon = false, icon, className, iconClassName, contentClassName, children }: SuccessPulseProps) => {
  const { classes } = useStyles()

  const [isShowingIcon, setIsShowingIcon] = useState(false)
  const [isContentVisible, setIsContentVisible] = useState(hideIcon)
  const [canExpandContent, setCanExpandContent] = useState(hideIcon)
  const [isContentEntering, setIsContentEntering] = useState(false)
  const iconTimerRef = useRef<number | null>(null)
  const enterTimerRef = useRef<number | null>(null)
  const hasAnimatedRef = useRef(false)

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
    clearTimers()

    const startContent = (withAnimation: boolean) => {
      setIsShowingIcon(false)
      setIsContentVisible(true)
      setCanExpandContent(true)
      setIsContentEntering(withAnimation)

      if (withAnimation) {
        enterTimerRef.current = window.setTimeout(() => {
          setIsContentEntering(false)
        }, SUCCESS_PULSE_ENTER_DURATION)
      }
    }

    if (hideIcon) {
      hasAnimatedRef.current = true
      startContent(false)
      return clearTimers
    }

    if (hasAnimatedRef.current) {
      startContent(false)
      return clearTimers
    }

    hasAnimatedRef.current = true
    setIsShowingIcon(true)
    setIsContentVisible(false)
    setCanExpandContent(false)
    setIsContentEntering(false)

    iconTimerRef.current = window.setTimeout(() => {
      startContent(true)
    }, SUCCESS_PULSE_ICON_DURATION)

    return clearTimers
  }, [clearTimers, hideIcon])

  return (
    <span className={clsx(classes.root, className)}>
      {!hideIcon && isShowingIcon && (
        <span
          className={clsx(classes.successIcon, iconClassName, isShowingIcon && classes.iconVisible, isShowingIcon && classes.iconEntering)}
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

const useStyles = makeStyles()(() => ({
  root: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: ICON_SIZE,
    minHeight: ICON_SIZE,
    overflow: 'visible'
  },
  successIcon: {
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
    backgroundColor: COLORS.nearBlack,
    borderRadius: '100px',
    '&::after': {
      content: '""',
      position: 'absolute',
      left: '50%',
      top: '50%',
      width: ICON_SIZE,
      height: ICON_SIZE,
      transform: 'translate(-50%, -50%) scale(0.8)',
      borderRadius: '100px',
      border: `4px solid ${COLORS.green}`,
      filter: 'blur(8px)',
      opacity: 1,
      zIndex: 0,
      pointerEvents: 'none'
    }
  },
  iconVisible: {
    opacity: 1,
    transform: 'scale(1)',
    filter: 'blur(0)'
  },
  iconEntering: {
    animation: `$pulseEnter ${SUCCESS_PULSE_ENTER_DURATION}ms cubic-bezier(0.25, 1, 0.5, 1) forwards`,
    '&::after': {
      animation: `$shockwave ${SUCCESS_PULSE_ENTER_DURATION * 2}ms cubic-bezier(0.25, 1, 0.5, 1) forwards`
    }
  },
  iconDefault: {
    fontSize: ICON_SIZE
  },
  content: {
    display: 'inline-flex',
    alignItems: 'center',
    position: 'relative',
    opacity: 0,
    maxWidth: 0,
    transform: 'scale(0.9)',
    filter: 'blur(8px)',
    transition: 'all 600ms cubic-bezier(0.25, 1, 0.5, 1)',
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
    '20%': {
      transform: 'scale(1.04)',
      filter: 'blur(0)'
    },
    '60%': {
      transform: 'scale(1)',
      filter: 'blur(0)'
    },
    '100%': {
      transform: 'scale(1)',
      filter: 'blur(0)'
    }
  },
  '@keyframes shockwave': {
    '0%': {
      transform: 'translate(-50%, -50%) scale(0.9)',
      opacity: 1,
      filter: 'blur(1px)'
    },
    '60%': {
      transform: 'translate(-50%, -50%) scale(1.3)',
      opacity: 0.15,
      filter: 'blur(18px)'
    },
    '80%': {
      transform: 'translate(-50%, -50%) scale(1.4)',
      opacity: 0.1,
      filter: 'blur(24px)'
    },
    '100%': {
      transform: 'translate(-50%, -50%) scale(1.5)',
      opacity: 0,
      filter: 'blur(24px)'
    }
  }
}))

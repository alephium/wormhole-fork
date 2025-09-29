import { makeStyles } from '@material-ui/core'
import CheckCircleIcon from '@material-ui/icons/CheckCircle'
import clsx from 'clsx'
import { ReactNode } from 'react'
import { useSuccessPulse, SUCCESS_PULSE_ENTER_DURATION } from './useSuccessPulse'

interface SuccessPulseProps {
  isActive?: boolean
  activationKey?: unknown
  hideIcon?: boolean
  icon?: ReactNode
  className?: string
  iconClassName?: string
  iconVisibleClassName?: string
  contentClassName?: string
  contentVisibleClassName?: string
  contentEnteringClassName?: string
  children: ReactNode
}

const useStyles = makeStyles(() => ({
  root: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 32,
    overflow: 'visible'
  },
  icon: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transform: 'scale(0.8)',
    filter: 'blur(8px)',
    transition: 'transform 360ms cubic-bezier(0.25, 1, 0.5, 1), opacity 260ms ease, filter 260ms ease',
    zIndex: 1,
    pointerEvents: 'none'
  },
  iconVisible: {
    opacity: 1,
    transform: 'scale(1)',
    filter: 'blur(0)'
  },
  iconDefault: {
    fontSize: '20px'
  },
  content: {
    display: 'inline-flex',
    alignItems: 'center',
    position: 'relative',
    opacity: 0,
    transform: 'scale(0.9)',
    filter: 'blur(8px)',
    transition: 'transform 520ms cubic-bezier(0.25, 1, 0.5, 1), opacity 320ms ease, filter 320ms ease',
    pointerEvents: 'auto'
  },
  contentVisible: {
    opacity: 1,
    transform: 'scale(1)',
    filter: 'blur(0)'
  },
  contentEntering: {
    animation: `$pulseEnter ${SUCCESS_PULSE_ENTER_DURATION}ms cubic-bezier(0.25, 1, 0.5, 1) forwards`
  },
  '@keyframes pulseEnter': {
    '0%': {
      transform: 'scale(0.92)',
      filter: 'blur(4px)'
    },
    '60%': {
      transform: 'scale(1.04)',
      filter: 'blur(0)'
    },
    '100%': {
      transform: 'scale(1)',
      filter: 'blur(0)'
    }
  }
}))

const SuccessPulse = ({
  isActive,
  activationKey,
  hideIcon = false,
  icon,
  className,
  iconClassName,
  iconVisibleClassName,
  contentClassName,
  contentVisibleClassName,
  contentEnteringClassName,
  children
}: SuccessPulseProps) => {
  const classes = useStyles()
  const { isShowingIcon, isContentVisible, isContentEntering } = useSuccessPulse({
    isActive,
    activationKey,
    hideIcon
  })

  return (
    <span className={clsx(classes.root, className)}>
      {!hideIcon && (
        <span
          className={clsx(
            classes.icon,
            iconClassName,
            isShowingIcon && classes.iconVisible,
            isShowingIcon && iconVisibleClassName
          )}
        >
          {icon ?? <CheckCircleIcon className={classes.iconDefault} />}
        </span>
      )}
      <span
        className={clsx(
          classes.content,
          contentClassName,
          isContentVisible && classes.contentVisible,
          isContentVisible && contentVisibleClassName,
          isContentEntering && classes.contentEntering,
          isContentEntering && contentEnteringClassName
        )}
        data-visible={isContentVisible ? 'true' : 'false'}
        data-entering={isContentEntering ? 'true' : undefined}
      >
        {children}
      </span>
    </span>
  )
}

export default SuccessPulse

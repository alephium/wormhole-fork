import { useCallback, useEffect, useRef, useState } from 'react'

interface UseSuccessPulseOptions {
  isActive?: boolean
  activationKey?: unknown
  iconDuration?: number
  enterDuration?: number
  hideIcon?: boolean
}

export interface SuccessPulseState {
  isShowingIcon: boolean
  isContentVisible: boolean
  isContentEntering: boolean
}

const DEFAULT_ICON_DURATION = 680
const DEFAULT_ENTER_DURATION = 800

export const useSuccessPulse = ({
  isActive,
  activationKey,
  iconDuration = DEFAULT_ICON_DURATION,
  enterDuration = DEFAULT_ENTER_DURATION,
  hideIcon = false
}: UseSuccessPulseOptions): SuccessPulseState => {
  const [isShowingIcon, setIsShowingIcon] = useState(false)
  const [isContentVisible, setIsContentVisible] = useState(() => (hideIcon ? true : false))
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
    const isActiveDefined = typeof isActive === 'boolean'
    const previousKey = prevActivationKeyRef.current
    const keyChanged = activationKey !== undefined && activationKey !== previousKey
    const shouldTriggerOnFirstRender = isFirstRenderRef.current && activationKey !== undefined && active

    prevActiveRef.current = active
    isFirstRenderRef.current = false
    if (keyChanged) {
      prevActivationKeyRef.current = activationKey
    }

    if (!keyChanged && activationKey !== previousKey) {
      prevActivationKeyRef.current = activationKey
    }

    const shouldTrigger = shouldTriggerOnFirstRender || keyChanged || (isActiveDefined && active && !wasActive)

    if (shouldTrigger) {
      clearTimers()
      const shouldShowIcon = !hideIcon
      setIsShowingIcon(shouldShowIcon)
      setIsContentVisible(!shouldShowIcon)
      setIsContentEntering(false)

      const startContent = () => {
        setIsShowingIcon(false)
        setIsContentVisible(true)
        setIsContentEntering(true)

        enterTimerRef.current = window.setTimeout(() => {
          setIsContentEntering(false)
        }, enterDuration)
      }

      if (shouldShowIcon) {
        iconTimerRef.current = window.setTimeout(startContent, iconDuration)
      } else {
        startContent()
      }
    } else if (isActiveDefined && !active) {
      clearTimers()
      setIsShowingIcon(false)
      if (!hideIcon) {
        setIsContentVisible(false)
      }
      setIsContentEntering(false)
    }

    return clearTimers
  }, [activationKey, clearTimers, enterDuration, iconDuration, isActive, hideIcon])

  return { isShowingIcon, isContentVisible, isContentEntering }
}

export const SUCCESS_PULSE_ENTER_DURATION = DEFAULT_ENTER_DURATION

import { useCallback, useEffect, useRef, useState } from 'react'

export type ActionKey = 'connect-source' | 'connect-target' | 'select-token' | 'next'

export type ActionConfig = {
  label: string
  onClick?: () => void
  disabled: boolean
}

const ACTION_ORDER: ActionKey[] = ['connect-source', 'connect-target', 'select-token', 'next']
const ACTION_INDEX: Record<ActionKey, number> = ACTION_ORDER.reduce(
  (acc, key, index) => ({ ...acc, [key]: index }),
  {} as Record<ActionKey, number>
)

export const CHECK_DISPLAY_DURATION = 420
export const LABEL_ANIMATION_DURATION = 800

interface UseMainActionTransitionArgs {
  currentActionKey: ActionKey
  currentAction: ActionConfig
  actionConfigs: Record<ActionKey, ActionConfig>
}

interface UseMainActionTransitionResult {
  renderedAction: ActionConfig
  isShowingCheck: boolean
  isLabelEntering: boolean
  isButtonDisabled: boolean
}

export const useMainActionTransition = ({
  currentActionKey,
  currentAction,
  actionConfigs
}: UseMainActionTransitionArgs): UseMainActionTransitionResult => {
  const [renderedActionKey, setRenderedActionKey] = useState<ActionKey>(currentActionKey)
  const renderedActionKeyRef = useRef(renderedActionKey)
  const isFirstRenderRef = useRef(true)
  const checkTimeoutRef = useRef<number | null>(null)
  const fadeTimeoutRef = useRef<number | null>(null)

  const [isShowingCheck, setIsShowingCheck] = useState(false)
  const [isLabelEntering, setIsLabelEntering] = useState(false)

  const updateRenderedActionKey = useCallback((key: ActionKey) => {
    setRenderedActionKey(key)
    renderedActionKeyRef.current = key
  }, [])

  const clearTimers = useCallback(() => {
    if (checkTimeoutRef.current !== null) {
      window.clearTimeout(checkTimeoutRef.current)
      checkTimeoutRef.current = null
    }
    if (fadeTimeoutRef.current !== null) {
      window.clearTimeout(fadeTimeoutRef.current)
      fadeTimeoutRef.current = null
    }
  }, [])

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false
      updateRenderedActionKey(currentActionKey)
      return
    }

    const previousKey = renderedActionKeyRef.current
    if (currentActionKey === previousKey) {
      return
    }

    clearTimers()

    const isProgressingForward = ACTION_INDEX[currentActionKey] > ACTION_INDEX[previousKey]
    if (!isProgressingForward) {
      updateRenderedActionKey(currentActionKey)
      setIsShowingCheck(false)
      setIsLabelEntering(false)
      return
    }

    setIsShowingCheck(true)
    setIsLabelEntering(false)

    checkTimeoutRef.current = window.setTimeout(() => {
      updateRenderedActionKey(currentActionKey)
      setIsShowingCheck(false)
      setIsLabelEntering(true)

      fadeTimeoutRef.current = window.setTimeout(() => {
        setIsLabelEntering(false)
      }, LABEL_ANIMATION_DURATION)
    }, CHECK_DISPLAY_DURATION)

    return clearTimers
  }, [clearTimers, currentActionKey, updateRenderedActionKey])

  useEffect(() => clearTimers, [clearTimers])

  const renderedAction = actionConfigs[renderedActionKey] ?? currentAction
  const isButtonDisabled = currentAction.disabled || isShowingCheck

  return {
    renderedAction,
    isShowingCheck,
    isLabelEntering,
    isButtonDisabled
  }
}

import { useEffect, useRef, useState } from 'react'

export type ActionKey = 'connect-source' | 'connect-target' | 'next'

export type ActionConfig = {
  label: string
  onClick?: () => void
  disabled: boolean
}

interface UseMainActionTransitionArgs {
  currentActionKey: ActionKey
  currentAction: ActionConfig
  actionConfigs: Record<ActionKey, ActionConfig>
}

interface UseMainActionTransitionResult {
  renderedAction: ActionConfig
  renderedActionKey: ActionKey
  isButtonDisabled: boolean
}

export const useMainActionTransition = ({
  currentActionKey,
  currentAction,
  actionConfigs
}: UseMainActionTransitionArgs): UseMainActionTransitionResult => {
  const [renderedActionKey, setRenderedActionKey] = useState<ActionKey>(currentActionKey)
  const previousKeyRef = useRef<ActionKey>(currentActionKey)

  useEffect(() => {
    const previousKey = previousKeyRef.current
    if (currentActionKey === previousKey) {
      return
    }

    previousKeyRef.current = currentActionKey
    setRenderedActionKey(currentActionKey)
  }, [currentActionKey])

  const renderedAction = actionConfigs[renderedActionKey] ?? currentAction

  return {
    renderedAction,
    renderedActionKey,
    isButtonDisabled: currentAction.disabled
  }
}

import { useEffect, useRef, useState } from 'react'

export type ActionKey = 'connect-source' | 'connect-target' | 'select-token' | 'next'

export type ActionConfig = {
  label: string
  onClick?: () => void
  disabled: boolean
}

const ACTION_FLOW: readonly ActionKey[] = ['connect-source', 'connect-target', 'select-token', 'next'] as const
const ACTION_INDEX: Record<ActionKey, number> = ACTION_FLOW.reduce(
  (acc, key, index) => ({ ...acc, [key]: index }),
  {} as Record<ActionKey, number>
)

interface UseMainActionTransitionArgs {
  currentActionKey: ActionKey
  currentAction: ActionConfig
  actionConfigs: Record<ActionKey, ActionConfig>
}

interface UseMainActionTransitionResult {
  renderedAction: ActionConfig
  renderedActionKey: ActionKey
  advanceToken: number
  isButtonDisabled: boolean
}

export const useMainActionTransition = ({
  currentActionKey,
  currentAction,
  actionConfigs
}: UseMainActionTransitionArgs): UseMainActionTransitionResult => {
  const [renderedActionKey, setRenderedActionKey] = useState<ActionKey>(currentActionKey)
  const [advanceToken, setAdvanceToken] = useState(0)
  const previousKeyRef = useRef<ActionKey>(currentActionKey)

  useEffect(() => {
    const previousKey = previousKeyRef.current
    if (currentActionKey === previousKey) {
      return
    }

    const advanced = ACTION_INDEX[currentActionKey] > ACTION_INDEX[previousKey]
    previousKeyRef.current = currentActionKey
    setRenderedActionKey(currentActionKey)
    if (advanced) {
      setAdvanceToken((token) => token + 1)
    }
  }, [currentActionKey])

  const renderedAction = actionConfigs[renderedActionKey] ?? currentAction

  return {
    renderedAction,
    renderedActionKey,
    advanceToken,
    isButtonDisabled: currentAction.disabled
  }
}

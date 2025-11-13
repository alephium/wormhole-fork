import { ReactNode, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { CHAIN_ID_ALEPHIUM, ChainId } from '@alephium/wormhole-sdk'

import {
  selectAttestActiveStep,
  selectAttestIsCreateComplete,
  selectAttestIsCreating,
  selectAttestIsSendComplete,
  selectAttestIsSending,
  selectAttestIsSourceComplete,
  selectAttestIsTargetComplete,
  selectAttestIsWalletApproved,
  selectAttestAttestTx,
  selectAttestCreateTx,
  selectAttestSourceAsset,
  selectAttestSourceChain,
  selectAttestTargetChain,
  selectAttestIsAlphPoolCreated
} from '../../../store/selectors'
import { setStep } from '../../../store/attestSlice'
import { CHAINS_BY_ID } from '../../../utils/consts'
import SmartAddress from '../../SmartAddress'
import SmartAddress2 from '../SmartAddress'
import KeyAndBalance from '../../KeyAndBalance'
import useIsWalletReady from '../../../hooks/useIsWalletReady'

export type AttestStepId = 0 | 1 | 2 | 3

export type StepStatus = 'pending' | 'active' | 'inProgress' | 'complete'

export interface StepDefinition {
  id: AttestStepId
  title: string
  description: string
  value?: ReactNode
  subLabel?: string
  isEditable?: boolean
  status: StepStatus
  disabled: boolean
  renderRawValue?: boolean
}

interface ActiveStepInput {
  isSourceComplete: boolean
  isTargetStepComplete: boolean
  isSendComplete: boolean
  isPoolCreationCompleted: boolean
}

interface UseAttestStepsResult {
  steps: StepDefinition[]
  derivedActiveStep: AttestStepId
  preventNavigation: boolean
  canEditStep: (stepId: AttestStepId) => boolean
  sourceChain: ChainId
  sourceAsset: string
  targetChain: ChainId
  isCreateComplete: boolean
}

const STEP_IDS: readonly AttestStepId[] = [0, 1, 2, 3]

const STEP_COPY = {
  0: {
    title: 'Source',
    description: 'Source chain and token to attest'
  },
  1: {
    title: 'Target',
    description: 'Chain where the wrapped token will live'
  },
  2: {
    title: 'Send attestation',
    description: 'Attestation transaction details'
  },
  3: {
    title: 'Create wrapped token',
    description: 'Wrapped token creation details'
  }
} as const

const EDITABLE_STEPS = new Set<AttestStepId>([0, 1])

const deriveActiveStep = ({
  isSourceComplete,
  isTargetStepComplete,
  isSendComplete,
  isPoolCreationCompleted
}: ActiveStepInput): AttestStepId => {
  if (!isSourceComplete) return 0
  if (!isTargetStepComplete) return 1
  if (!isSendComplete) return 2
  if (!isPoolCreationCompleted) return 2
  return 3
}

export const canEditStep = (stepId: AttestStepId) => EDITABLE_STEPS.has(stepId)

export function useAttestSteps(): UseAttestStepsResult {
  const { t } = useTranslation()
  const dispatch = useDispatch()

  const activeStep = useSelector(selectAttestActiveStep)
  const isSending = useSelector(selectAttestIsSending)
  const isSendComplete = useSelector(selectAttestIsSendComplete)
  const isCreating = useSelector(selectAttestIsCreating)
  const isCreateComplete = useSelector(selectAttestIsCreateComplete)
  const isSourceComplete = useSelector(selectAttestIsSourceComplete)
  const isTargetComplete = useSelector(selectAttestIsTargetComplete)
  const isWalletApproved = useSelector(selectAttestIsWalletApproved)
  const isAlphPoolCreated = useSelector(selectAttestIsAlphPoolCreated)
  const sourceChain = useSelector(selectAttestSourceChain)
  const sourceAsset = useSelector(selectAttestSourceAsset)
  const targetChain = useSelector(selectAttestTargetChain)
  const attestTx = useSelector(selectAttestAttestTx)
  const createTx = useSelector(selectAttestCreateTx)

  const { isReady: isTargetWalletReady } = useIsWalletReady(targetChain)
  const isTargetStepComplete = isTargetComplete && isTargetWalletReady

  const isSourceAlph = sourceChain === CHAIN_ID_ALEPHIUM
  const derivedActiveStep = deriveActiveStep({
    isSourceComplete,
    isTargetStepComplete,
    isSendComplete,
    isPoolCreationCompleted: isSourceAlph ? isAlphPoolCreated : true
  })

  useEffect(() => {
    if (activeStep !== derivedActiveStep) {
      dispatch(setStep(derivedActiveStep))
    }
  }, [activeStep, derivedActiveStep, dispatch])

  const preventNavigation = (isSending || isSendComplete || isCreating) && !isCreateComplete

  const stepTranslations = STEP_IDS.reduce<Record<AttestStepId, { title: string; description: string }>>((acc, id) => {
    acc[id] = {
      title: t(STEP_COPY[id].title),
      description: t(STEP_COPY[id].description)
    }
    return acc
  }, {} as Record<AttestStepId, { title: string; description: string }>)

  const baseStatusForStep = (stepId: AttestStepId): StepStatus => {
    if (stepId < derivedActiveStep) return 'complete'
    if (stepId === derivedActiveStep) return 'active'
    return 'pending'
  }

  const statusForStep = (stepId: AttestStepId): StepStatus => {
    if (stepId === 2) {
      if (isSending || isWalletApproved || (isSourceAlph && !isAlphPoolCreated)) {
        return 'inProgress'
      }
      return baseStatusForStep(stepId)
    }

    if (stepId === 3) {
      if (isCreateComplete) return 'complete'
      if (isCreating) return 'inProgress'
      return baseStatusForStep(stepId)
    }

    return baseStatusForStep(stepId)
  }

  const sourceValue =
    isSourceComplete && sourceAsset ? <SmartAddress chainId={sourceChain} address={sourceAsset} isAsset /> : undefined

  const sourceSubLabel = isSourceComplete
    ? t('Will be attested on {{ chainName }}', {
        chainName: CHAINS_BY_ID[sourceChain]?.name ?? t('Unknown chain')
      })
    : undefined

  const hasTargetChainInfo = !!CHAINS_BY_ID[targetChain]
  const shouldShowTargetConnectButton = isSourceComplete && hasTargetChainInfo && !isTargetWalletReady

  const targetValue = isTargetStepComplete ? (
    <span>{CHAINS_BY_ID[targetChain]?.name ?? t('Unknown chain')}</span>
  ) : shouldShowTargetConnectButton ? (
    <KeyAndBalance chainId={targetChain} />
  ) : undefined

  const sendValue = attestTx ? <SmartAddress2 chainId={sourceChain} transactionAddress={attestTx.id} /> : undefined

  const createValue = createTx ? <SmartAddress2 chainId={targetChain} transactionAddress={createTx.id} /> : undefined

  const steps: StepDefinition[] = [
    {
      id: 0,
      title: stepTranslations[0].title,
      description: stepTranslations[0].description,
      value: sourceValue,
      subLabel: sourceSubLabel,
      isEditable: true,
      status: statusForStep(0),
      disabled: preventNavigation || isCreateComplete
    },
    {
      id: 1,
      title: stepTranslations[1].title,
      description: stepTranslations[1].description,
      value: targetValue,
      isEditable: true,
      status: statusForStep(1),
      disabled: preventNavigation || isCreateComplete,
      renderRawValue: shouldShowTargetConnectButton
    },
    {
      id: 2,
      title: stepTranslations[2].title,
      description: stepTranslations[2].description,
      value: sendValue,
      subLabel: attestTx ? t('Transaction hash') : undefined,
      status: statusForStep(2),
      disabled: isSendComplete
    },
    {
      id: 3,
      title: stepTranslations[3].title,
      description: stepTranslations[3].description,
      value: createValue,
      subLabel: createTx ? t('Wrapped token transaction') : undefined,
      status: statusForStep(3),
      disabled: !isSendComplete
    }
  ]

  return {
    steps,
    derivedActiveStep,
    preventNavigation,
    canEditStep,
    sourceChain,
    sourceAsset,
    targetChain,
    isCreateComplete
  }
}

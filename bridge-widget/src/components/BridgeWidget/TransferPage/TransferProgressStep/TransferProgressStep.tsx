import { useCallback, useEffect } from 'react'
import SendTransactionSection from './SendTransactionSection'
import BridgingProgressSection from './BridgingProgressSection'
import ManualRedeemSection from './ManualRedeemSection'
import TransferMoreTokensButton from './TransferMoreTokensButton'
import MainActionButton from '../../MainActionButton'
import { useDispatch, useSelector } from 'react-redux'
import {
  selectTransferHasSentTokens,
  selectTransferIsSending,
  selectTransferIsWalletApproved,
  selectTransferTargetChain,
  selectTransferUseRelayer
} from '../../../../store/selectors'
import useGetIsTransferCompleted from '../../../../hooks/useGetIsTransferCompleted'
import { CHAIN_ID_ALEPHIUM } from '@alephium/wormhole-sdk'
import { useSnackbar } from 'notistack'
import WalletReconnectSection from './WalletReconnectSection'
import { setBridgeWidgetStep } from '../../../../store/widgetSlice'
import useTransferOrRecoveryTxExists from '../../useTransferOrRecoveryTxExists'

const TransferProgressStep = () => {
  const hasSentTokens = useSelector(selectTransferHasSentTokens)
  const useRelayer = useSelector(selectTransferUseRelayer)
  const targetChain = useSelector(selectTransferTargetChain)
  const isSending = useSelector(selectTransferIsSending)
  const isWalletApproved = useSelector(selectTransferIsWalletApproved)
  const txExists = useTransferOrRecoveryTxExists()
  const useAutoRelayer = targetChain === CHAIN_ID_ALEPHIUM
  const shouldCheckCompletion = useRelayer || useAutoRelayer
  const isTransferCompleted = useGetIsTransferCompleted(!shouldCheckCompletion, shouldCheckCompletion ? 5000 : undefined)
  const { error } = isTransferCompleted
  const { enqueueSnackbar } = useSnackbar()
  const dispatch = useDispatch()

  const goToReview = useCallback(() => dispatch(setBridgeWidgetStep(1)), [dispatch])

  useEffect(() => {
    if (!isSending && !isWalletApproved && !txExists) {
      goToReview()
    }
  }, [goToReview, isSending, isWalletApproved, txExists])

  useEffect(() => {
    if (error) {
      enqueueSnackbar(error, {
        variant: 'error',
        preventDuplicate: true
      })
    }
  }, [error, enqueueSnackbar])
  return (
    <div style={{ display: 'flex', gap: '20px', width: '100%', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: '20px', width: '100%', flexDirection: 'column' }}>
        <SendTransactionSection />

        <BridgingProgressSection isTransferCompleted={isTransferCompleted} />
      </div>

      <WalletReconnectSection isTransferCompleted={isTransferCompleted} />

      <ManualRedeemSection isTransferCompleted={isTransferCompleted} />

      <MainActionButton />

      {(hasSentTokens || isTransferCompleted.isTransferCompleted) && <TransferMoreTokensButton isTransferCompleted={isTransferCompleted} />}
    </div>
  )
}

export default TransferProgressStep

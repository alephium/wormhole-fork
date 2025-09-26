import BridgingHasStarted from './BridgingHasStarted'
import SendTransactionSection from './SendTransactionSection'
import BridgingProgressSection from './BridgingProgressSection'
import ManualRedeemSection from './ManualRedeemSection'
import TransferMoreTokensButton from './TransferMoreTokensButton'
import MainActionButton from '../MainActionButton'
import { selectTransferTargetChain, selectTransferUseRelayer } from '../../../store/selectors'
import { useSelector } from 'react-redux'
import { CHAIN_ID_ALEPHIUM } from '@alephium/wormhole-sdk'
import useGetIsTransferCompleted from '../../../hooks/useGetIsTransferCompleted'
import { useEffect } from 'react'
import { useSnackbar } from 'notistack'

const TransferStep = () => {
  const { enqueueSnackbar } = useSnackbar()
  const useRelayer = useSelector(selectTransferUseRelayer)
  const targetChain = useSelector(selectTransferTargetChain)
  const useAutoRelayer = targetChain === CHAIN_ID_ALEPHIUM
  const shouldCheckCompletion = useRelayer || useAutoRelayer
  const { isTransferCompleted, isTransferCompletedLoading, error } = useGetIsTransferCompleted(
    !shouldCheckCompletion,
    shouldCheckCompletion ? 5000 : undefined
  )

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
      <div style={{ display: 'flex', gap: '10px', width: '100%', flexDirection: 'column' }}>
        <SendTransactionSection />

        <BridgingHasStarted />

        <BridgingProgressSection isTransferCompleted={isTransferCompleted} />
      </div>

      <TransferMoreTokensButton isTransferCompleted={isTransferCompleted} />

      {!isTransferCompleted && (
        <ManualRedeemSection isTransferCompletedLoading={isTransferCompletedLoading} error={error} />
      )}

      <MainActionButton />
    </div>
  )
}

export default TransferStep

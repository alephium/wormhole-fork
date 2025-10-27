import { useEffect } from 'react'
import SendTransactionSection from './SendTransactionSection'
import BridgingProgressSection from './BridgingProgressSection'
import ManualRedeemSection from './ManualRedeemSection'
import TransferMoreTokensButton from './TransferMoreTokensButton'
import MainActionButton from '../MainActionButton'
import { useSelector } from 'react-redux'
import {
  selectTransferHasSentTokens,
  selectTransferTargetChain,
  selectTransferUseRelayer
} from '../../../store/selectors'
import useGetIsTransferCompleted from '../../../hooks/useGetIsTransferCompleted'
import { CHAIN_ID_ALEPHIUM } from '@alephium/wormhole-sdk'
import { useSnackbar } from 'notistack'
import WalletReconnectSection from './WalletReconnectSection'

const TransferStep = () => {
  const hasSentTokens = useSelector(selectTransferHasSentTokens)
  const useRelayer = useSelector(selectTransferUseRelayer)
  const targetChain = useSelector(selectTransferTargetChain)
  const useAutoRelayer = targetChain === CHAIN_ID_ALEPHIUM
  const shouldCheckCompletion = useRelayer || useAutoRelayer
  const isTransferCompleted = useGetIsTransferCompleted(
    !shouldCheckCompletion,
    shouldCheckCompletion ? 5000 : undefined
  )
  const { error } = isTransferCompleted
  const { enqueueSnackbar } = useSnackbar()

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

      {(hasSentTokens || isTransferCompleted.isTransferCompleted) && (
        <TransferMoreTokensButton isTransferCompleted={isTransferCompleted} />
      )}
    </div>
  )
}

export default TransferStep

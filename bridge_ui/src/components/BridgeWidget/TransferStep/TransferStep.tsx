import SendTransactionSection from './SendTransactionSection'
import BridgingProgressSection from './BridgingProgressSection'
import ManualRedeemSection from './ManualRedeemSection'
import TransferMoreTokensButton from './TransferMoreTokensButton'
import MainActionButton from '../MainActionButton'
import { useSelector } from 'react-redux'
import { selectTransferHasSentTokens } from '../../../store/selectors'

const TransferStep = () => {
  const hasSentTokens = useSelector(selectTransferHasSentTokens)
  return (
    <div style={{ display: 'flex', gap: '20px', width: '100%', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: '20px', width: '100%', flexDirection: 'column' }}>
        <SendTransactionSection />

        <BridgingProgressSection />
      </div>

      <ManualRedeemSection />

      <MainActionButton />

      {hasSentTokens && <TransferMoreTokensButton />}
    </div>
  )
}

export default TransferStep

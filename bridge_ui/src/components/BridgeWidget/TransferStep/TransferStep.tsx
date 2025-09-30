import SendTransactionSection from './SendTransactionSection'
import BridgingProgressSection from './BridgingProgressSection'
import ManualRedeemSection from './ManualRedeemSection'
import TransferMoreTokensButton from './TransferMoreTokensButton'
import MainActionButton from '../MainActionButton'

const TransferStep = () => {
  return (
    <div style={{ display: 'flex', gap: '20px', width: '100%', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: '20px', width: '100%', flexDirection: 'column' }}>
        <SendTransactionSection />

        <BridgingProgressSection />
      </div>

      <TransferMoreTokensButton />

      <ManualRedeemSection />

      <MainActionButton />
    </div>
  )
}

export default TransferStep

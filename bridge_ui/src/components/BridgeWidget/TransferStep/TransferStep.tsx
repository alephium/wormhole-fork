import BridgingHasStarted from './BridgingHasStarted'
import SendTransactionSection from './SendTransactionSection'
import BridgingProgressSection from './BridgingProgressSection'
import ManualRedeemSection from './ManualRedeemSection'
import TransferMoreTokensButton from './TransferMoreTokensButton'
import ConnectWalletsButtons from '../ConnectWalletsButtons'

const TransferStep = () => {
  return (
    <div style={{ display: 'flex', gap: '20px', width: '100%', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: '10px', width: '100%', flexDirection: 'column' }}>
        <SendTransactionSection />

        <BridgingHasStarted />

        <BridgingProgressSection />
      </div>

      <TransferMoreTokensButton />

      <ManualRedeemSection />

      <ConnectWalletsButtons />
    </div>
  )
}

export default TransferStep

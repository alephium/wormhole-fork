import { useSelector } from 'react-redux'
import { selectBridgeWidgetPage, selectTransferActiveBridgeWidgetStep } from '../../../store/selectors'
import HistoryNavItem from './HistoryNavItem'
import RecoveryNavItem from './RecoveryNavItem'

const PageNavigation = () => {
  const page = useSelector(selectBridgeWidgetPage)
  const transferStep = useSelector(selectTransferActiveBridgeWidgetStep)

  if (page !== 'bridge' || transferStep !== 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <HistoryNavItem />
      <RecoveryNavItem />
    </div>
  )
}

export default PageNavigation

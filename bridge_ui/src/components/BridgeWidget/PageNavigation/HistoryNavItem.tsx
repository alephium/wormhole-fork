import { ListOutlined } from '@mui/icons-material'
import { useDispatch, useSelector } from 'react-redux'
import { selectTransferSourceChain, selectTransferTargetChain } from '../../../store/selectors'
import useIsWalletReady from '../../../hooks/useIsWalletReady'
import { useTranslation } from 'react-i18next'
import { setBridgeWidgetPage } from '../../../store/widgetSlice'
import BridgeWidgetNavItem from './BridgeWidgetNavItem'

const HistoryNavItem = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const transferSourceChain = useSelector(selectTransferSourceChain)
  const transferTargetChain = useSelector(selectTransferTargetChain)
  const { isReady: isSourceWalletReady } = useIsWalletReady(transferSourceChain, false)
  const { isReady: isTargetWalletReady } = useIsWalletReady(transferTargetChain, false)

  return (
    <BridgeWidgetNavItem
      title={t('History')}
      onClick={() => dispatch(setBridgeWidgetPage('history'))}
      tooltipDisabledTitle={t('Wallets should be connected to display bridging history')}
      disabled={!isSourceWalletReady || !isTargetWalletReady}
      Icon={ListOutlined}
    />
  )
}

export default HistoryNavItem

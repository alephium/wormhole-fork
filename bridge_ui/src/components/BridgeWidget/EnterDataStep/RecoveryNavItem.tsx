import { setBridgeWidgetPage } from '../../../store/transferSlice'
import { RestoreOutlined } from '@mui/icons-material'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import { selectTransferSourceChain } from '../../../store/selectors'
import useIsWalletReady from '../../../hooks/useIsWalletReady'
import BridgeWidgetNavItem from './BridgeWidgetNavItem'

const RecoveryNavItem = () => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const transferSourceChain = useSelector(selectTransferSourceChain)
  const { isReady: isSourceWalletReady } = useIsWalletReady(transferSourceChain, false)

  return (
    <BridgeWidgetNavItem
      title={t('Recovery')}
      onClick={() => dispatch(setBridgeWidgetPage('recovery'))}
      tooltipDisabledTitle={t('Connect the origin chain wallet to recover a transaction')}
      disabled={!isSourceWalletReady}
      Icon={RestoreOutlined}
    />
  )
}

export default RecoveryNavItem

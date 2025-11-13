import { useSelector } from 'react-redux'
import { selectTransferRecoverySourceTxId, selectTransferTransferTx } from '../../store/selectors'

const useTransferOrRecoveryTxExists = () => {
  const transferTx = useSelector(selectTransferTransferTx)
  const recoverySourceTx = useSelector(selectTransferRecoverySourceTxId)

  return !!(transferTx || recoverySourceTx)
}

export default useTransferOrRecoveryTxExists

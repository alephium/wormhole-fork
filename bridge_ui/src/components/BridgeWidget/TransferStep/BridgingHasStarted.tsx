import { KeyboardArrowDown } from '@material-ui/icons'
import { useSelector } from 'react-redux'
import { selectTransferTransferTx } from '../../../store/selectors'
import { GRAY } from '../styles'

const BridgingHasStarted = () => {
  const transferTx = useSelector(selectTransferTransferTx)

  if (!transferTx) return null

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        flexDirection: 'column'
      }}
    >
      <div style={{ fontSize: '14px', color: GRAY, fontStyle: 'italic' }}>Bridging has started.</div>
      <KeyboardArrowDown style={{ fontSize: '10px', color: GRAY }} />
    </div>
  )
}

export default BridgingHasStarted

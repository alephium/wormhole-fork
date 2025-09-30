import { useSelector } from 'react-redux'
import { selectTransferTransferTx } from '../../../store/selectors'
import { CircularProgress, makeStyles } from '@material-ui/core'
import { COLORS } from '../../../muiTheme'

const OngoingBridgingBadge = () => {
  const transferTx = useSelector(selectTransferTransferTx)
  const classes = useStyles()

  if (!transferTx) return null

  return (
    <div
      className={classes.container}
    >
      <div className={classes.badge}>
        <CircularProgress size={20} style={{ color: COLORS.white }} />
        Bridging...</div>
    </div>
  )
}

export default OngoingBridgingBadge

const useStyles = makeStyles((theme) => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '16px',
    color: COLORS.nearWhite,
    border: `1px solid ${COLORS.whiteWithTransparency}`,
    backgroundColor: COLORS.blue,
    padding: '4px 10px',
    borderRadius: '100px',
    animation: '$badgePulse 4s ease-in-out infinite'
  },
  '@keyframes badgePulse': {
    '0%': {
      filter: 'brightness(0.96)'
    },
    '50%': {
      filter: 'brightness(1.2)'
    },
    '100%': {
      filter: 'brightness(0.96)'
    }
  }
}));

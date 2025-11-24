import { CircularProgress } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { COLORS } from '../../../../muiTheme'
import useManualRedeemNecessary from '../../../../hooks/useManualRedeemNecessary'
import useTransferOrRecoveryTxExists from '../../useTransferOrRecoveryTxExists'

const OngoingBridgingBadge = () => {
  const txExists = useTransferOrRecoveryTxExists()
  const { classes } = useStyles()
  const { manualRedeemToAlephiumRequired, manualRedeemToEvmRequired } = useManualRedeemNecessary()
  const isManualRedeemRequired = manualRedeemToAlephiumRequired || manualRedeemToEvmRequired

  if (!txExists) return null

  return (
    <div className={classes.container}>
      <div className={classes.badge} style={{ backgroundColor: isManualRedeemRequired ? COLORS.darkGrey : COLORS.blue }}>
        <CircularProgress size={20} style={{ color: isManualRedeemRequired ? COLORS.gray : COLORS.white }} />
        {isManualRedeemRequired ? 'Waiting for manual redeem...' : 'Bridging...'}
      </div>
    </div>
  )
}

export default OngoingBridgingBadge

const useStyles = makeStyles()(() => ({
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
      filter: 'brightness(0.9)',
      boxShadow: '0 0 0px 0 rgba(9, 137, 241, 0.2)'
    },
    '50%': {
      filter: 'brightness(1.2)',
      boxShadow: '0 0 10px 0 rgba(9, 137, 241, 0.4)'
    },
    '100%': {
      filter: 'brightness(0.9)',
      boxShadow: '0 0 0px 0 rgba(9, 137, 241, 0.2)'
    }
  }
}))

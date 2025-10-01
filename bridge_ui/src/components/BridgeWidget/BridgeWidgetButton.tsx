import { Button, ButtonProps, makeStyles } from '@material-ui/core'
import clsx from 'clsx'
import { COLORS } from '../../muiTheme'

type BridgeWidgetButtonProps = ButtonProps & { tone?: 'default' | 'primaryNext' }

const BridgeWidgetButton = ({ className, variant = 'contained', tone = 'default', ...props }: BridgeWidgetButtonProps) => {
  const classes = useStyles()

  return (
    <Button
      className={clsx(classes.button, tone === 'primaryNext' && classes.primaryNext, className)}
      variant={variant}
      color="primary"
      fullWidth
      {...props}
    />
  )
}

export default BridgeWidgetButton

const useStyles = makeStyles(() => ({
  button: {
    textTransform: 'none',
    borderRadius: '16px',
    height: '52px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 500,
    fontSize: '16px',
    letterSpacing: 'normal',
    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    '&.MuiButton-containedPrimary': {
      backgroundColor: COLORS.nearWhite,
      color: COLORS.nearBlack,
      '&:hover': {
        transform: 'scale(1.005)',
        backgroundColor: COLORS.white,
        filter: 'brightness(1.02)'
      }
    },
    '&.MuiButton-outlinedPrimary': {
      backgroundColor: COLORS.whiteWithMoreTransparency,
      borderColor: COLORS.whiteWithTransparency,
      color: COLORS.nearWhite,
      '&:hover': {
        transform: 'scale(1.005)',
        color: COLORS.white,
        backgroundColor: COLORS.whiteWithTransparency
      }
    },
    '&.Mui-disabled': {
      backgroundColor: 'rgba(255, 255, 255, 0.65)',
      color: 'rgba(0, 0, 0, 0.35)'
    }
  },
  primaryNext: {
    '&.MuiButton-containedPrimary': {
      backgroundColor: COLORS.blueWithTransparency,
      color: COLORS.white,
      '&:hover': {
        backgroundColor: COLORS.blue,
        color: COLORS.white
      }
    }
  }
}))

import { Button, ButtonProps, CircularProgress } from '@mui/material'
import { makeStyles } from '@mui/styles';
import clsx from 'clsx'
import { COLORS } from '../../muiTheme'

export type BridgeWidgetButtonProps = ButtonProps & {
  tone?: 'default' | 'primaryNext'
  isLoading?: boolean
  short?: boolean
}

const BridgeWidgetButton = ({
  className,
  variant = 'contained',
  tone = 'default',
  isLoading,
  short,
  ...props
}: BridgeWidgetButtonProps) => {
  const classes = useStyles()

  return (
    <Button
      className={clsx(classes.button, tone === 'primaryNext' && classes.primaryNext, short && classes.short, className)}
      variant={variant}
      color="primary"
      fullWidth
      {...props}
    >
      {isLoading ? <CircularProgress size={20} color="inherit" /> : props.children}
    </Button>
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
    fontWeight: 550,
    fontSize: '16px',
    letterSpacing: 'normal',
    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    '&.MuiButton-containedPrimary': {
      backgroundColor: COLORS.nearWhite,
      color: COLORS.nearBlack,
      '&:hover': {
        transform: 'scale(1.005)',
        backgroundColor: COLORS.white,
        filter: 'brightness(1.1)'
      }
    },
    '&.MuiButton-outlinedPrimary': {
      backgroundColor: COLORS.whiteWithStrongTransparency,
      borderColor: COLORS.whiteWithStrongTransparency,
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
      backgroundColor: COLORS.blue,
      color: COLORS.white,
      '&:hover': {
        filter: 'brightness(1.1)',
        backgroundColor: COLORS.blue,
        color: COLORS.white
      }
    }
  },
  short: {
    height: '36px',
    borderRadius: '12px'
  }
}))

import { Button, ButtonProps, makeStyles } from '@material-ui/core'
import clsx from 'clsx'
import { COLORS } from '../../muiTheme'

const BridgeWidgetButton = ({ className, ...props }: ButtonProps) => {
  const classes = useStyles()

  return (
    <Button
      className={clsx(classes.button, className)}
      variant="contained"
      color="primary"
      fullWidth
      {...props}
    />
  )
}

export default BridgeWidgetButton

const useStyles = makeStyles(() => ({
  button: {
    backgroundColor: COLORS.nearWhite,
    textTransform: 'none',
    borderRadius: '16px',
    height: '52px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(0, 0, 0, 1)',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 500,
    fontSize: '16px',
    letterSpacing: 'normal',
    transition: 'all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    '&.Mui-disabled': {
      backgroundColor: 'rgba(255, 255, 255, 0.65)',
      color: 'rgba(0, 0, 0, 0.35)'
    },
    '&:hover': {
      transform: 'scale(1.005)',
      backgroundColor: COLORS.white,
      filter: 'brightness(1.02)'
    }
  }
}))

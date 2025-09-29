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
    transition: 'all 0.2s ease-in-out',
    letterSpacing: 'normal',
    '&:hover': {
      backgroundColor: COLORS.white
    }
  }
}))

import { Button, ButtonProps, makeStyles } from '@material-ui/core'

const BridgeWidgetButton = (props: ButtonProps) => {
  const classes = useStyles()

  return <Button className={classes.button} variant="contained" color="primary" fullWidth {...props} />
}

export default BridgeWidgetButton

const useStyles = makeStyles(() => ({
  button: {
    backgroundColor: '#f2f2f2',
    boxShadow: '0 8px 15px rgba(0, 0, 0, 1)',
    textTransform: 'none',
    borderRadius: '100px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(0, 0, 0, 1)',
    fontFamily: 'Inter, sans-serif',
    fontWeight: 600,
    fontSize: '14px',
    transition: 'all 0.2s ease-in-out',
    letterSpacing: 'normal',
    '&:hover': {
      backgroundColor: 'rgba(242, 242, 242, 0.8)'
    }
  }
}))

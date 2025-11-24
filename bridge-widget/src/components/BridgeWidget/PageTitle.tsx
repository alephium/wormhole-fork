import { ArrowBackOutlined } from '@mui/icons-material'
import { IconButton, Typography } from '@mui/material'
import { useDispatch, useSelector } from 'react-redux'
import { makeStyles } from 'tss-react/mui'
import { selectBridgeWidgetPage, selectTransferActiveBridgeWidgetStep } from '../../store/selectors'
import { reset } from '../../store/transferSlice'

const PageTitle = () => {
  const { classes } = useStyles()
  const page = useSelector(selectBridgeWidgetPage)
  const transferStep = useSelector(selectTransferActiveBridgeWidgetStep)
  const dispatch = useDispatch()

  const title =
    transferStep === 0
      ? page === 'bridge'
        ? 'Bridge'
        : page === 'recovery'
        ? 'Recovery'
        : 'Bridging history'
      : transferStep === 1
      ? 'Review'
      : ''

  return (
    <div className={classes.pageTitle}>
      {page !== 'bridge' && (
        <IconButton onClick={() => dispatch(reset())} size="small">
          <ArrowBackOutlined fontSize="small" />
        </IconButton>
      )}
      <Typography variant="h1">{title}</Typography>
    </div>
  )
}

export default PageTitle

const useStyles = makeStyles()((theme) => ({
  pageTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: 24,
    [theme.breakpoints.down('sm')]: {
      marginBottom: 0
    }
  }
}))

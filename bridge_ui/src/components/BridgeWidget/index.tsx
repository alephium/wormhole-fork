import { ChainId } from '@alephium/wormhole-sdk'
import { Container, IconButton, Typography } from '@mui/material'
import { makeStyles } from '@mui/styles';
import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router'
import useCheckIfWormholeWrapped from '../../hooks/useCheckIfWormholeWrapped'
import useFetchTargetAsset from '../../hooks/useFetchTargetAsset'
import {
  selectBridgeWidgetPage,
  selectTransferActiveBridgeWidgetStep,
  selectTransferIsRedeemComplete,
  selectTransferIsRedeeming,
  selectTransferIsSendComplete,
  selectTransferIsSending
} from '../../store/selectors'
import { reset, setSourceChain, setTargetChain } from '../../store/transferSlice'
import { CHAINS_BY_ID } from '../../utils/consts'
import BridgeWidgetSteps from './BridgeWidgetSteps'
import { useWidgetStyles } from './styles'
import { ArrowBackOutlined } from '@mui/icons-material'
import Recovery from './Recovery/Recovery'
import TransactionsHistory from './TransactionsHistory/TransactionsHistory'
import HistoryNavItem from './EnterDataStep/HistoryNavItem'
import RecoveryNavItem from './EnterDataStep/RecoveryNavItem'

const BridgeWidget = () => {
  useCheckIfWormholeWrapped()
  useFetchTargetAsset()
  useUrlPathParams()
  usePreventNavigation()

  const step = useSelector(selectTransferActiveBridgeWidgetStep)
  const classes = useStyles()
  const widgetClasses = useWidgetStyles()
  const dispatch = useDispatch()

  const page = useSelector(selectBridgeWidgetPage)

  const title =
    step === 0
      ? page === 'bridge'
        ? 'Bridge'
        : page === 'recovery'
        ? 'Recovery'
        : 'Bridging history'
      : step === 1
      ? 'Review'
      : ''

  return (
    <Container maxWidth="md" className={classes.mainContainer}>
      <div className={classes.innerContainer}>
        <div className={widgetClasses.spaceBetween}>
          <div className={classes.pageTitle}>
            {page !== 'bridge' && (
              <IconButton onClick={() => dispatch(reset())} size="small">
                <ArrowBackOutlined fontSize="small" />
              </IconButton>
            )}
            <Typography variant="h1">{title}</Typography>
          </div>

          {page === 'bridge' && step === 0 && (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <RecoveryNavItem />
              <HistoryNavItem />
            </div>
          )}
        </div>
        <div className={classes.mainBox}>
          <div className={classes.stack}>
            {page === 'bridge' ? <BridgeWidgetSteps /> : page === 'recovery' ? <Recovery /> : <TransactionsHistory />}
          </div>
        </div>
      </div>
    </Container>
  )
}

export default BridgeWidget

const useUrlPathParams = () => {
  const dispatch = useDispatch()
  const { search } = useLocation()
  const query = useMemo(() => new URLSearchParams(search), [search])
  const pathSourceChain = query.get('sourceChain')
  const pathTargetChain = query.get('targetChain')

  useEffect(() => {
    if (!pathSourceChain && !pathTargetChain) {
      return
    }
    try {
      const sourceChain: ChainId = CHAINS_BY_ID[parseFloat(pathSourceChain || '') as ChainId]?.id
      const targetChain: ChainId = CHAINS_BY_ID[parseFloat(pathTargetChain || '') as ChainId]?.id

      if (sourceChain === targetChain) {
        return
      }
      if (sourceChain) {
        dispatch(setSourceChain(sourceChain))
      }
      if (targetChain) {
        dispatch(setTargetChain(targetChain))
      }
    } catch (e) {
      console.error('Invalid path params specified.')
    }
  }, [pathSourceChain, pathTargetChain, dispatch])
}

const usePreventNavigation = () => {
  const isSending = useSelector(selectTransferIsSending)
  const isSendComplete = useSelector(selectTransferIsSendComplete)
  const isRedeeming = useSelector(selectTransferIsRedeeming)
  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete)
  const preventNavigation = (isSending || isSendComplete || isRedeeming) && !isRedeemComplete

  useEffect(() => {
    if (preventNavigation) {
      window.onbeforeunload = () => true
      return () => {
        window.onbeforeunload = null
      }
    }
  }, [preventNavigation])
}

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    padding: theme.spacing(3, 2),
    [theme.breakpoints.down('sm')]: {
      width: '100%',
      padding: theme.spacing(2, 1.5),
      alignItems: 'stretch'
    }
  },
  pageTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: 24,
    [theme.breakpoints.down('sm')]: {
      marginBottom: 0
    }
  },
  innerContainer: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: 520,
    margin: '0 auto',
    [theme.breakpoints.down('sm')]: {
      gap: theme.spacing(2.5),
      maxWidth: '100%'
    }
  },
  mainBox: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    maxWidth: 520,
    width: '100%',
    gap: '10px',
    [theme.breakpoints.down('sm')]: {
      maxWidth: '100%'
    }
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    gap: '24px',
    [theme.breakpoints.down('sm')]: {
      gap: theme.spacing(2)
    }
  },
  confirmButton: {
    backgroundColor: '#080808',
    color: 'rgba(255, 255, 255, 1)',
    boxShadow: '0 8px 15px rgba(0, 0, 0, 0.2)',
    position: 'relative',
    gap: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '44px',
    width: '80%',
    maxWidth: '250px',
    borderRadius: '100px',
    fontWeight: 600,
    fontSize: '14px',
    margin: '10px 0',
    padding: '0 14px',
    minWidth: '60px',
    textAlign: 'center',
    cursor: 'pointer',
    backdropFilter: 'blur(20px) saturate(180%) brightness(115%)'
  }
}))

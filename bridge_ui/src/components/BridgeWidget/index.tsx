import { ChainId } from '@alephium/wormhole-sdk'
import { Container, makeStyles, Typography } from '@material-ui/core'
import { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useLocation } from 'react-router'
import useCheckIfWormholeWrapped from '../../hooks/useCheckIfWormholeWrapped'
import useFetchTargetAsset from '../../hooks/useFetchTargetAsset'
import {
  selectTransferActiveBridgeWidgetStep,
  selectTransferIsRedeemComplete,
  selectTransferIsRedeeming,
  selectTransferIsSendComplete,
  selectTransferIsSending
} from '../../store/selectors'
import { setSourceChain, setTargetChain } from '../../store/transferSlice'
import { CHAINS_BY_ID } from '../../utils/consts'
import BridgeWidgetSteps from './BridgeWidgetSteps'

const BridgeWidget = () => {
  useCheckIfWormholeWrapped()
  useFetchTargetAsset()
  useUrlPathParams()
  usePreventNavigation()
  
  const step = useSelector(selectTransferActiveBridgeWidgetStep)
  const classes = useStyles()

  const title = step === 0 ? 'Bridge' : step === 1 ? 'Review' : ''

  return (
    <Container maxWidth="md" className={classes.mainContainer}>
      <div className={classes.innerContainer}>
        <div>
          <Typography variant='h1' style={{ margin: 0 }}>{title}</Typography>
        </div>
        <div className={classes.mainBox}>
          <div className={classes.stack}>
            <BridgeWidgetSteps />
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
    [theme.breakpoints.down('xs')]: {
      width: '100%',
      padding: theme.spacing(2, 1.5),
      alignItems: 'stretch'
    }
  },
  innerContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    width: '100%',
    maxWidth: 520,
    margin: '0 auto',
    [theme.breakpoints.down('xs')]: {
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
    [theme.breakpoints.down('xs')]: {
      maxWidth: '100%'
    }
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    gap: '24px',
    [theme.breakpoints.down('xs')]: {
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

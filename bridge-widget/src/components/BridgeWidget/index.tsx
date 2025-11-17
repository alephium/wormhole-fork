import { Container } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { useEffect } from 'react'
import { useSelector } from 'react-redux'
import useCheckIfWormholeWrapped from '../../hooks/useCheckIfWormholeWrapped'
import useFetchTargetAsset from '../../hooks/useFetchTargetAsset'
import {
  selectBridgeWidgetPage,
  selectTransferIsRedeemComplete,
  selectTransferIsRedeeming,
  selectTransferIsSendComplete,
  selectTransferIsSending
} from '../../store/selectors'
import TransferPage from './TransferPage/TransferPage'
import { useWidgetStyles } from './styles'
import RecoveryPage from './RecoveryPage/RecoveryPage'
import TransactionsHistoryPage from './TransactionsHistoryPage/TransactionsHistoryPage'
import PageNavigation from './PageNavigation/PageNavigation'
import PageTitle from './PageTitle'
import RegisterTokenPage from './RegisterTokenPage/RegisterTokenPage'
import {
  AlephiumWalletProvider,
  createDesktopWalletConnector,
  createWalletConnectConnector
} from '@alephium/web3-react'
import { Provider } from 'react-redux'
import { store } from '../../store'
import { SnackbarProvider } from 'notistack'
import { SolanaWalletProvider } from '../../contexts/SolanaWalletContext'
import { EthereumProviderProvider } from '../../contexts/EthereumProviderContext'
import { AlgorandContextProvider } from '../../contexts/AlgorandWalletContext'
import { getConst, getCluster } from '../../utils/consts'

const connectors = {
  walletConnect: createWalletConnectConnector({ customStoragePrefix: 'alephium' }),
  desktopWallet: createDesktopWalletConnector({ customStoragePrefix: 'alephium' })
}

const BridgeWidget = () => {
  return (
    <Provider store={store}>
      <SnackbarProvider maxSnack={3}>
        <SolanaWalletProvider>
          <EthereumProviderProvider>
            <AlephiumWalletProvider
              network={getCluster()}
              addressGroup={getConst('ALEPHIUM_BRIDGE_GROUP_INDEX')}
              connectors={connectors}
            >
              <AlgorandContextProvider>
                <BridgeWidgetRoutes />
              </AlgorandContextProvider>
            </AlephiumWalletProvider>
          </EthereumProviderProvider>
        </SolanaWalletProvider>
      </SnackbarProvider>
    </Provider>
  )
}

export default BridgeWidget

const BridgeWidgetRoutes = () => {
  useCheckIfWormholeWrapped()
  useFetchTargetAsset()
  usePreventNavigation()

  const { classes } = useStyles()
  const { classes: widgetClasses } = useWidgetStyles()

  const page = useSelector(selectBridgeWidgetPage)

  return (
    <Container maxWidth="md" className={classes.mainContainer}>
      <div className={classes.innerContainer}>
        <div className={widgetClasses.spaceBetween}>
          <PageTitle />
          <PageNavigation />
        </div>
        <div className={classes.mainBox}>
          <div className={classes.stack}>
            {page === 'bridge' ? (
              <TransferPage />
            ) : page === 'recovery' ? (
              <RecoveryPage />
            ) : page === 'register' ? (
              <RegisterTokenPage />
            ) : page === 'history' ? (
              <TransactionsHistoryPage />
            ) : null}
          </div>
        </div>
      </div>
    </Container>
  )
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

const useStyles = makeStyles()((theme) => ({
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

import "./i18n";

import { CssBaseline } from "@mui/material";
import { ThemeProvider, StyledEngineProvider } from "@mui/material/styles";
import { SnackbarProvider } from "notistack";
import { createRoot } from 'react-dom/client';
import { Provider } from "react-redux";
import { HashRouter } from "react-router-dom";
import App from "./App";
import ErrorBoundary from "./ErrorBoundary";
import { theme } from "./muiTheme";
import { store } from "./store";
import { AlephiumWalletProvider, createWalletConnectConnector, createDesktopWalletConnector } from "@alephium/web3-react";
import { CLUSTER, ALEPHIUM_BRIDGE_GROUP_INDEX } from "./utils/consts";
import { WalletProviders, setCluster, EthereumWalletProvider, AlgorandContextProvider, SolanaWalletProvider } from "@alephium/bridge-widget";

setCluster(CLUSTER);

const connectors = {
  walletConnect: createWalletConnectConnector({customStoragePrefix: 'alephium'}),
  desktopWallet: createDesktopWalletConnector({customStoragePrefix: 'alephium'})
}

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <ErrorBoundary>
    <Provider store={store}>
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <ErrorBoundary>
            <SnackbarProvider maxSnack={3}>
              <WalletProviders
                network={CLUSTER}
                addressGroup={ALEPHIUM_BRIDGE_GROUP_INDEX}
                connectors={connectors}
              >
                <HashRouter>
                  <App />
                </HashRouter>
              </WalletProviders>
            </SnackbarProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </StyledEngineProvider>
    </Provider>
  </ErrorBoundary>
);

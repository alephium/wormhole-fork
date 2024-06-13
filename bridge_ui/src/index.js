import "./i18n";

import { CssBaseline } from "@material-ui/core";
import { ThemeProvider } from "@material-ui/core/styles";
import { SnackbarProvider } from "notistack";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { AlgorandContextProvider } from "./contexts/AlgorandWalletContext";
import { BetaContextProvider } from "./contexts/BetaContext";
import { EthereumProviderProvider } from "./contexts/EthereumProviderContext";
import { SolanaWalletProvider } from "./contexts/SolanaWalletContext.tsx";
import { TerraWalletProvider } from "./contexts/TerraWalletContext.tsx";
import ErrorBoundary from "./ErrorBoundary";
import { theme } from "./muiTheme";
import { store } from "./store";
import { AlephiumWalletProvider } from "@alephium/web3-react";
import { CLUSTER, ALEPHIUM_BRIDGE_GROUP_INDEX } from "./utils/consts";

ReactDOM.render(
  <ErrorBoundary>
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <SnackbarProvider maxSnack={3}>
            <BetaContextProvider>
              <SolanaWalletProvider>
                <EthereumProviderProvider>
                  <TerraWalletProvider>
                    <AlephiumWalletProvider
                      network={CLUSTER}
                      addressGroup={ALEPHIUM_BRIDGE_GROUP_INDEX}
                    >
                      <AlgorandContextProvider>
                        <HashRouter>
                          <App />
                        </HashRouter>
                      </AlgorandContextProvider>
                    </AlephiumWalletProvider>
                  </TerraWalletProvider>
                </EthereumProviderProvider>
              </SolanaWalletProvider>
            </BetaContextProvider>
          </SnackbarProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </Provider>
  </ErrorBoundary>,
  document.getElementById("root")
);

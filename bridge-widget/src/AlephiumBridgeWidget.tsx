import { BridgeWidget } from '@alephium/bridge-common';
import { useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import { theme } from '@alephium/bridge-common';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

const AlephiumBridgeWidget = () => {
  useEffect(() => {
    // IMPORTANT: This is a workaround to expose the Redux store to the window object so it can be used in automated tests.
    if (!globalThis.dispatchReduxAction) {
      (window as any).dispatchReduxAction = (action: any) => {
        // store.dispatch(action);
      };
    }
  }, []);

  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <div>HELLO from the Alephium Bridge Widget!</div>
          <BridgeWidget />
        </ErrorBoundary>
      </ThemeProvider>
    </StyledEngineProvider>
  );
};

export default AlephiumBridgeWidget;

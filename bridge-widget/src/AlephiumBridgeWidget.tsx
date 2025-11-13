import { BridgeWidget } from '@alephium/bridge-common';
import ErrorBoundary from './components/ErrorBoundary';
import { theme } from '@alephium/bridge-common';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';

const AlephiumBridgeWidget = () => {
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ErrorBoundary>
          <BridgeWidget />
        </ErrorBoundary>
      </ThemeProvider>
    </StyledEngineProvider>
  );
};

export default AlephiumBridgeWidget;

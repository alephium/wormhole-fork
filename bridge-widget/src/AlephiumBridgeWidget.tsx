import ErrorBoundary from './components/ErrorBoundary'
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import { theme } from './muiTheme'
import BridgeWidget from './components/BridgeWidget'

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
  )
}

export default AlephiumBridgeWidget

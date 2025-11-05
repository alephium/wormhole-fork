import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary';
import AlephiumBridgeWidget from './AlephiumBridgeWidget';

// This is the sample app used for local development

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);

root.render(
  <StrictMode>
    <ErrorBoundary>
      <AlephiumBridgeWidget />
    </ErrorBoundary>
  </StrictMode>
);

import { createRoot } from 'react-dom/client';
import ErrorBoundary from './components/ErrorBoundary';
import AlephiumBridgeWidget from './AlephiumBridgeWidget';
import { StrictMode } from 'react';

// This is the entry point that runs when integrators add the Alephium Bridge Widget
// to their websites by pasting <script> and <link> tags pointing to the
// unpkg.com hosted build.
//
// It has some logic for backwards compatibility for older integrations, but
// the official interface is now providing a DOM element with:
//
// - id: "alephium-bridge-widget"

const container = document.getElementById('alephium-bridge-widget') as HTMLElement;
const root = createRoot(container);

if (!container) {
  throw new Error(
    'Could not find an element with id "alephium-bridge-widget". Please add one to use the Alephium Bridge Widget.',
  );
}

/* @ts-ignore */
// const config = window.__WIDGET_CONFIG as WormholeConnectConfig;
/* @ts-ignore */
// const theme = window.__WIDGET_THEME as WormholeConnectPartialTheme;

root.render(
  <StrictMode>
    <ErrorBoundary>
      <AlephiumBridgeWidget />
    </ErrorBoundary>
  </StrictMode>
);

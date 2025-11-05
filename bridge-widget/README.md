# Alephium Bridge Widget [![npm version](https://img.shields.io/npm/v/@alephium/bridge-widget.svg)](https://www.npmjs.com/package/@alephium/bridge-widget)

Alephium Bridge Widget is a React widget for cross-chain asset transfers.

## Getting Started

### Via NPM for React apps (Recommended)

If you're using React, you can import the `<AlephiumBridgeWidget />` component directly into your JSX:

#### Installation

```bash
npm i @alephium/bridge-widget
```

#### Using the component

```javascript
import WormholeConnect from ' @alephium/bridge-widget';

function App() {
  return (
    <AlephiumBridgeWidget />
  );
}
```

### Alternative: hosted version via CDN (for any website)

If you're not using React, you can still embed Connect on your website by using the hosted version:

```ts
import {
  alephiumBridgeWidgetHosted,
} from '@alephium/bridge-widget';

const container = document.getElementById('alephium-bridge-widget')!;

alephiumBridgeWidgetHosted(container);
```

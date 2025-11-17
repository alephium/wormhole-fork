# Alephium Bridge Widget [![npm version](https://img.shields.io/npm/v/@alephium/bridge-widget.svg)](https://www.npmjs.com/package/@alephium/bridge-widget)

Alephium Bridge Widget is a React widget for cross-chain asset transfers.

## Getting Started

### Via NPM for React apps (Recommended)

If you're using React, you can import the `<AlephiumBridgeWidget />` component directly into your JSX:

#### Installation

```bash
npm i @alephium/bridge-widget
```

You should also install the peer dependencies:

```bash
npm i @alephium/web3-react
```

#### Using the component

```javascript
import AlephiumBridgeWidget, { WalletProviders } from '@alephium/bridge-widget';

function App() {
  return (
    <WalletProviders>
      <AlephiumBridgeWidget />
    </WalletProviders>
  );
}
```

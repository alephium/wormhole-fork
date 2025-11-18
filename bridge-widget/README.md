# Alephium Bridge Widget [![npm version](https://img.shields.io/npm/v/@alephium/bridge-widget.svg)](https://www.npmjs.com/package/@alephium/bridge-widget)

Alephium Bridge Widget is a React component library for cross-chain asset transfers to and from the Alephium blockchain.

## Getting Started

### Installation

```bash
npm i @alephium/bridge-widget
```

You should also install the peer dependencies:

```bash
npm i @alephium/web3 @alephium/web3-react
```

### Usage

```tsx
import AlephiumBridgeWidget, { WalletProviders } from '@alephium/bridge-widget';

function App() {
  return (
    <WalletProviders>
      <AlephiumBridgeWidget />
    </WalletProviders>
  );
}
```

`WalletProviders` supplies the necessary wallet contexts for the bridge widget to work. It **excludes** Alephium by
default since it assumes that your React dApp will already provide one, to avoid conflicts. If your dApp does not
provide one, you can enable it with:

```tsx
<WalletProviders includeAlephium>
  <AlephiumBridgeWidget />
</WalletProviders>
```

## Development

```bash
npm i
```

To publish to a local registry, you can use [Verdaccio](https://verdaccio.org/):

```bash
npx verdaccio
```

Then, you can build and publish the package:

```bash
npm run build
npm publish --registry http://localhost:4873
```

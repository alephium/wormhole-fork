import { NetworkId } from '@alephium/web3';
import {
  AlephiumWalletProvider,
  Connectors,
  createDesktopWalletConnector,
  createWalletConnectConnector,
} from '@alephium/web3-react';
import { getCluster, getConst } from '../utils/consts';
import { EthereumWalletProvider } from '../contexts/EthereumProviderContext';
import { SolanaWalletProvider } from '../contexts/SolanaWalletContext';
import { AlgorandContextProvider } from '../contexts/AlgorandWalletContext';

export function WalletProviders({
  network,
  addressGroup,
  connectors,
  children,
}: {
  network?: NetworkId;
  addressGroup?: number;
  connectors?: Connectors;
  children: React.ReactNode;
}) {
  const _network = network ?? getCluster();
  const _addressGroup = addressGroup ?? getConst('ALEPHIUM_BRIDGE_GROUP_INDEX');
  const _connectors = connectors ?? defaultConnectors;

  return (
    <SolanaWalletProvider>
      <EthereumWalletProvider>
        <AlgorandContextProvider>
          <AlephiumWalletProvider
            network={_network}
            addressGroup={_addressGroup}
            connectors={_connectors}
          >
            {children}
          </AlephiumWalletProvider>
        </AlgorandContextProvider>
      </EthereumWalletProvider>
    </SolanaWalletProvider>
  );
}

const defaultConnectors = {
  walletConnect: createWalletConnectConnector({
    customStoragePrefix: 'alephium',
  }),
  desktopWallet: createDesktopWalletConnector({
    customStoragePrefix: 'alephium',
  }),
};

import detectEthereumProvider from "@metamask/detect-provider";
import EthereumProvider from "@walletconnect/ethereum-provider";
import { BigNumber, ethers } from "ethers";
import React, {
  ReactChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import metamaskIcon from "../icons/metamask-fox.svg";
import walletconnectIcon from "../icons/walletconnect.svg";
import { EVM_RPC_MAP } from "../utils/metaMaskChainParameters";
import QRCodeModal from '@alephium/walletconnect-qrcode-modal'
import { getEvmChainId } from "../utils/consts";
import { CHAIN_ID_BSC, CHAIN_ID_ETH, ChainId } from "@alephium/wormhole-sdk";
import { useTranslation } from "react-i18next";

const WALLET_CONNECT_PROJECT_ID = '6e2562e43678dd68a9070a62b6d52207'
export type Provider = ethers.providers.Web3Provider | undefined;
export type Signer = ethers.Signer | undefined;

export enum ConnectType {
  METAMASK,
  WALLETCONNECT,
}

export interface Connection {
  connectType: ConnectType;
  name: string;
  icon: string;
}

interface IEthereumProviderContext {
  connect(connectType: ConnectType, chainId: ChainId): void;
  disconnect(): void;
  provider: Provider;
  chainId: number | undefined;
  signer: Signer;
  signerAddress: string | undefined;
  providerError: string | null;
  availableConnections: Connection[];
  walletConnectProvider: EthereumProvider | undefined;
  connectType: ConnectType | undefined;
}

const EthereumProviderContext = React.createContext<IEthereumProviderContext>({
  connect: (connectType: ConnectType, chainId: ChainId) => {},
  disconnect: () => {},
  provider: undefined,
  chainId: undefined,
  signer: undefined,
  signerAddress: undefined,
  providerError: null,
  availableConnections: [],
  connectType: undefined,
  walletConnectProvider: undefined,
});

export const EthereumProviderProvider = ({
  children,
}: {
  children: ReactChildren;
}) => {
  const { t } = useTranslation();
  const [providerError, setProviderError] = useState<string | null>(null);
  const [provider, setProvider] = useState<Provider>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [signer, setSigner] = useState<Signer>(undefined);
  const [signerAddress, setSignerAddress] = useState<string | undefined>(
    undefined
  );
  const [availableConnections, setAvailableConnections] = useState<
    Connection[]
  >([]);
  const [connectType, setConnectType] = useState<ConnectType | undefined>(
    undefined
  );
  const [ethereumProvider, setEthereumProvider] = useState<any>(undefined);
  const [walletConnectProvider, setWalletConnectProvider] = useState<
    EthereumProvider | undefined
  >(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const connections: Connection[] = [];
      try {
        const detectedProvider = await detectEthereumProvider();
        if (detectedProvider) {
          connections.push({
            connectType: ConnectType.METAMASK,
            name: "MetaMask",
            icon: metamaskIcon,
          });
        }
      } catch (error) {
        console.error(error);
      }
      connections.push({
        connectType: ConnectType.WALLETCONNECT,
        name: "WalletConnect",
        icon: walletconnectIcon,
      });
      if (!cancelled) {
        setAvailableConnections(connections);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (walletConnectProvider?.chainId !== undefined) {
      setChainId(walletConnectProvider.chainId)
    }
  }, [walletConnectProvider?.chainId])

  const disconnect = useCallback(() => {
    setProviderError(null);
    setProvider(undefined);
    setChainId(undefined);
    setSigner(undefined);
    setSignerAddress(undefined);
    setConnectType(undefined);
    if (ethereumProvider?.removeAllListeners) {
      ethereumProvider.removeAllListeners();
    }
    setEthereumProvider(undefined);
    if (walletConnectProvider) {
      walletConnectProvider
        .disconnect()
        .catch((error: any) => console.error(error));
      setWalletConnectProvider(undefined);
    }
  }, [ethereumProvider, walletConnectProvider]);

  const connect = useCallback(
    (connectType: ConnectType, wormholeChainId: ChainId) => {
      setConnectType(connectType);
      if (connectType === ConnectType.METAMASK) {
        detectEthereumProvider()
          .then((detectedProvider) => {
            if (detectedProvider) {
              setEthereumProvider(detectedProvider);
              const provider = new ethers.providers.Web3Provider(
                // @ts-ignore
                detectedProvider,
                "any"
              );
              provider
                .send("eth_requestAccounts", [])
                .then(() => {
                  setProviderError(null);
                  setProvider(provider);
                  provider
                    .getNetwork()
                    .then((network) => {
                      setChainId(network.chainId);
                    })
                    .catch(() => {
                      setProviderError(
                        t("An error occurred while getting the network")
                      );
                    });
                  const signer = provider.getSigner();
                  setSigner(signer);
                  signer
                    .getAddress()
                    .then((address) => {
                      setSignerAddress(address);
                    })
                    .catch(() => {
                      setProviderError(
                        t("An error occurred while getting the signer address")
                      );
                    });
                  // TODO: try using ethers directly
                  // @ts-ignore
                  if (detectedProvider && detectedProvider.on) {
                    // @ts-ignore
                    detectedProvider.on("chainChanged", (chainId) => {
                      try {
                        setChainId(BigNumber.from(chainId).toNumber());
                      } catch (e) {}
                    });
                    // @ts-ignore
                    detectedProvider.on("accountsChanged", (accounts) => {
                      try {
                        const signer = provider.getSigner();
                        setSigner(signer);
                        signer
                          .getAddress()
                          .then((address) => {
                            setSignerAddress(address);
                          })
                          .catch(() => {
                            setProviderError(
                              t("An error occurred while getting the signer address")
                            );
                          });
                      } catch (e) {}
                    });
                  }
                })
                .catch(() => {
                  setProviderError(
                    t("An error occurred while requesting eth accounts")
                  );
                });
            } else {
              setProviderError(t("Please install MetaMask"));
            }
          })
          .catch(() => {
            setProviderError(t("Please install MetaMask"));
          });
      } else if (connectType === ConnectType.WALLETCONNECT) {
        EthereumProvider.init({
          projectId: WALLET_CONNECT_PROJECT_ID,
          showQrModal: false,
          chains: [getEvmChainId(CHAIN_ID_ETH) as number, getEvmChainId(CHAIN_ID_BSC) as number],
          rpcMap: EVM_RPC_MAP,
          customStoragePrefix: 'ethereum'
        }).then((walletConnectProvider) => {
          setWalletConnectProvider(walletConnectProvider);
          walletConnectProvider.on('display_uri', (uri) => {
            QRCodeModal.open(uri, () => console.log('qr closed'))
          })
          walletConnectProvider
            .enable()
            .then(() => {
              QRCodeModal.close()
              setProviderError(null);
              const provider = new ethers.providers.Web3Provider(
                walletConnectProvider,
                "any"
              );
              provider
                .getNetwork()
                .then((network) => {
                  setChainId(network.chainId);
                })
                .catch(() => {
                  setProviderError(t("An error occurred while getting the network"));
                });
              walletConnectProvider.on(
                "accountsChanged",
                (accounts: string[]) => {
                  try {
                    const signer = provider.getSigner();
                    setSigner(signer);
                    signer
                      .getAddress()
                      .then((address) => {
                        setSignerAddress(address);
                      })
                      .catch(() => {
                        setProviderError(
                          t("An error occurred while getting the signer address")
                        );
                      });
                  } catch (error) {
                    console.error(error);
                  }
                }
              );
              walletConnectProvider.on(
                "disconnect",
                () => { disconnect() }
              );
              walletConnectProvider.on(
                'chainChanged',
                (hexChainId) => setChainId(BigNumber.from(hexChainId).toNumber())
              );
              setProvider(provider);
              const signer = provider.getSigner();
              setSigner(signer);
              signer
                .getAddress()
                .then((address) => {
                  setSignerAddress(address);
                })
                .catch((error) => {
                  setProviderError(
                    t("An error occurred while getting the signer address")
                  );
                  console.error(error);
                });
            })
            .catch((error) => {
              if (error.message !== "User closed modal") {
                setProviderError(t("Error enabling WalletConnect session"));
                console.error(error);
              }
            });
        })
      }
    },
    [disconnect, t]
  );

  const contextValue = useMemo(
    () => ({
      connect,
      disconnect,
      provider,
      chainId,
      signer,
      signerAddress,
      providerError,
      availableConnections,
      connectType,
      walletConnectProvider
    }),
    [
      connect,
      disconnect,
      provider,
      chainId,
      signer,
      signerAddress,
      providerError,
      availableConnections,
      connectType,
      walletConnectProvider
    ]
  );
  return (
    <EthereumProviderContext.Provider value={contextValue}>
      {children}
    </EthereumProviderContext.Provider>
  );
};
export const useEthereumProvider = () => {
  return useContext(EthereumProviderContext);
};

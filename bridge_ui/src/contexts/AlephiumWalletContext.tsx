import QRCodeModal from '@walletconnect/qrcode-modal'
import { WalletConnectProvider } from '@alephium/walletconnect-provider'
import { NodeProvider, Account, SignerProvider, web3, Address, groupOfAddress } from '@alephium/web3'
import { Context, createContext, ReactChildren, useCallback, useContext, useMemo, useState } from 'react'
import { ALEPHIUM_HOST, ALEPHIUM_NETWORK_ID, CLUSTER, WALLET_CONNECT_ALPH_PROJECT_ID } from '../utils/consts'
import { connect as connectToExtension, AlephiumWindowObject } from '@alephium/get-extension-wallet'

export enum ConnectType {
  WALLETCONNECT,
  WEBEXTENSION
}

export class AlephiumWalletSigner {
  signerProvider: SignerProvider
  address: Address
  group: number
  nodeProvider: NodeProvider

  constructor(signerProvider: SignerProvider, address: Address | undefined) {
    if (address === undefined) {
      throw new Error(`Wallet is not connected`)
    }
    this.address = address
    this.group = groupOfAddress(address)
    this.signerProvider = signerProvider
    this.nodeProvider = new NodeProvider(ALEPHIUM_HOST)
  }
}

export interface AlephiumWallet {
  connect(connectType: ConnectType): void
  disconnect(): void
  signer: AlephiumWalletSigner | undefined
  error: string | undefined
  uri?: string
}

// @ts-ignore
export const WalletContext: Context<AlephiumWallet> = createContext<AlephiumWallet>()

export function useAlephiumWallet(): AlephiumWallet {
  return useContext(WalletContext)
}

export const AlephiumWalletProvider = ({
  children,
}: {
  children: ReactChildren;
}) => {
  web3.setCurrentNodeProvider(ALEPHIUM_HOST)
  const [uri, setUri] = useState<string | undefined>(undefined)
  const [walletConnectProvider, setWalletConnectProvider] = useState<WalletConnectProvider | undefined>(undefined)
  const [alephiumWindowObject, setAlephiumWindowObject] = useState<AlephiumWindowObject | undefined>(undefined)
  const [address, setAddress] = useState<Address | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)
  const connect = useCallback(async (connectType: ConnectType) => {
    if (connectType === ConnectType.WALLETCONNECT) {
      const provider = await WalletConnectProvider.init({
        networkId: ALEPHIUM_NETWORK_ID,
        logger: 'info',
        projectId: WALLET_CONNECT_ALPH_PROJECT_ID,
        relayUrl: 'wss://relay.walletconnect.com',
        metadata: {
          name: 'Wormhole Bridge',
          description: 'Wormhole bridge',
          url: 'https://walletconnect.com/',
          icons: ['https://walletconnect.com/walletconnect-logo.png']
        }
      })

      provider.on('displayUri', async (uri: string) => {
        setUri(uri)
        QRCodeModal.open(uri, () => {
          console.log('QR code modal closed')
        })
      })

      provider.on('accountChanged', (account: Account) => {
        setUri(undefined)
        setAddress(account.address)
      })

      await provider.connect()
      setWalletConnectProvider(provider)
      QRCodeModal.close()
    } else if (connectType === ConnectType.WEBEXTENSION) {
      const windowAlephium = await connectToExtension({ include: ["alephium"] })
      if (typeof windowAlephium !== 'undefined') {
        await windowAlephium.enable({ networkId: 'dex', onDisconnected: () => {
          setAlephiumWindowObject(undefined)
          setAddress(undefined)
          return Promise.resolve()
        }})
        const address = await windowAlephium.getSelectedAddress()
        setAddress(address)
        setAlephiumWindowObject(windowAlephium)

        windowAlephium.on('networkChanged', (network) => {
          console.log(`Network changed to ${network.id}`)
          if (CLUSTER !== 'devnet' && CLUSTER !== network.id) {
            setError(`Invalid network ${network.id}, please connect to ${CLUSTER}`)
          } else {
            setError(undefined)
          }
        })

        windowAlephium.on('addressesChanged', async (addresses: string[]) => {
          if (addresses.length === 0) {
            setAddress(undefined)
          } else {
            const address = await windowAlephium.getSelectedAddress()
            setAddress(address)
          }
        })
      }
    }
  }, [])

  const disconnect = useCallback(async () => {
    await walletConnectProvider?.disconnect()
    setWalletConnectProvider(undefined)
    setAlephiumWindowObject(undefined)
    setAddress(undefined)
  }, [walletConnectProvider])

  const contextValue = useMemo(() => ({
    connect: connect,
    disconnect: disconnect,
    signer:
      walletConnectProvider
        ? new AlephiumWalletSigner(walletConnectProvider, address)
        : alephiumWindowObject
          ? new AlephiumWalletSigner(alephiumWindowObject, address)
          : undefined,
    error: error,
    uri: uri
  }), [
    connect,
    disconnect,
    walletConnectProvider,
    alephiumWindowObject,
    address,
    error,
    uri
  ])

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>
}

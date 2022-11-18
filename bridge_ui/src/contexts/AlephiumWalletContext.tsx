import QRCodeModal from '@walletconnect/qrcode-modal'
import { WalletConnectProvider } from '@alephium/walletconnect-provider'
import { NodeProvider, Account, SignerProvider } from '@alephium/web3'
import { Context, createContext, ReactChildren, useCallback, useContext, useMemo, useState } from 'react'
import { ALEPHIUM_HOST, ALEPHIUM_NETWORK_ID, CLUSTER, WALLET_CONNECT_ALPH_PROJECT_ID } from '../utils/consts'
import { connect as connectToExtension, AlephiumWindowObject } from '@alephium/get-extension-wallet'

export enum ConnectType {
  WALLETCONNECT,
  WEBEXTENSION
}

export class AlephiumWalletSigner {
  signerProvider: SignerProvider
  account: Account
  nodeProvider: NodeProvider

  constructor(signerProvider: SignerProvider, account: Account | undefined) {
    if (account === undefined) {
      throw new Error(`Wallet is not connected`)
    }
    this.signerProvider = signerProvider
    this.account = account
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
  const [uri, setUri] = useState<string | undefined>(undefined)
  const [walletConnectProvider, setWalletConnectProvider] = useState<WalletConnectProvider | undefined>(undefined)
  const [alephiumWindowObject, setAlephiumWindowObject] = useState<AlephiumWindowObject | undefined>(undefined)
  const [account, setAccount] = useState<Account | undefined>(undefined)
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
        setAccount(account)
      })

      await provider.connect()
      setWalletConnectProvider(provider)
      QRCodeModal.close()
    } else if (connectType === ConnectType.WEBEXTENSION) {
      const windowAlephium = await connectToExtension({ include: ["alephium"] })
      if (typeof windowAlephium !== 'undefined') {
        await windowAlephium.enable()
        const account = await windowAlephium.getSelectedAccount()
        setAccount(account)
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
            setAccount(undefined)
          } else {
            const account = await windowAlephium.getSelectedAccount()
            setAccount(account)
          }
        })
      }
    }
  }, [])

  const disconnect = useCallback(async () => {
    await walletConnectProvider?.disconnect()
    setWalletConnectProvider(undefined)
    setAlephiumWindowObject(undefined)
    setAccount(undefined)
  }, [walletConnectProvider])

  const contextValue = useMemo(() => ({
    connect: connect,
    disconnect: disconnect,
    signer:
      walletConnectProvider
        ? new AlephiumWalletSigner(walletConnectProvider as SignerProvider, account)
        : alephiumWindowObject
          ? new AlephiumWalletSigner(alephiumWindowObject as SignerProvider, account)
          : undefined,
    error: error,
    uri: uri
  }), [
    connect,
    disconnect,
    walletConnectProvider,
    alephiumWindowObject,
    account,
    error,
    uri
  ])

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>
}

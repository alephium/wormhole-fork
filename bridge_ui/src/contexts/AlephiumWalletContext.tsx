import SignerClient from '@walletconnect/sign-client'
import QRCodeModal from '@walletconnect/qrcode-modal'
import WalletConnectProvider, { signerMethods, PROVIDER_EVENTS } from 'alph-walletconnect-provider-for-test'
import { NodeProvider, Account, SignerProvider } from '@alephium/web3'
import { Context, createContext, ReactChildren, useCallback, useContext, useMemo, useState } from 'react'
import { ALEPHIUM_HOST, ALEPHIUM_NETWORK_ID, WALLET_CONNECT_ALPH_PROJECT_ID } from '../utils/consts'
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
  const connect = useCallback(async (connectType: ConnectType) => {
    if (connectType === ConnectType.WALLETCONNECT) {
      const signerClient = await SignerClient.init({
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

      const provider = new WalletConnectProvider({
        networkId: ALEPHIUM_NETWORK_ID,
        chainGroup: undefined, // undefined means all groups, 0/1/2/3 means only the specific group is allowed
        methods: signerMethods,
        client: signerClient,
      })

      provider.on(PROVIDER_EVENTS.connect, (e: any) => {
        QRCodeModal.close()
      })

      provider.on(PROVIDER_EVENTS.displayUri, async (uri: string) => {
        setUri(uri)
        QRCodeModal.open(uri, () => {
          console.log('QR code modal closed')
        })
      })

      provider.on(PROVIDER_EVENTS.accountChanged, (accounts: Account[]) => {
        setUri(undefined)
        setAccount(accounts[0])
      })

      provider.on(PROVIDER_EVENTS.disconnect, (code: number, reason: string) => {
        setUri(undefined)
        setAccount(undefined)
      })

      await provider.connect()
      setWalletConnectProvider(provider)
    } else if (connectType === ConnectType.WEBEXTENSION) {
      const windowAlephium = await connectToExtension({ include: ["alephium"] })
      if (typeof windowAlephium !== 'undefined') {
        await windowAlephium.enable()
        const account = await windowAlephium.getSelectedAccount()
        setAccount(account)
        setAlephiumWindowObject(windowAlephium)

        windowAlephium.on("addressesChanged", (_) => {
          // TODO: await windowAlephium.getSelectedAccount()
        })

        windowAlephium.on("networkChanged", (_) => {
          // TODO: await windowAlephium.getSelectedAccount()
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
        ? new AlephiumWalletSigner(walletConnectProvider, account)
        : alephiumWindowObject
          ? new AlephiumWalletSigner(alephiumWindowObject, account)
          : undefined,
    uri: uri
  }), [
    connect,
    disconnect,
    walletConnectProvider,
    alephiumWindowObject,
    account,
    uri
  ])

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>
}

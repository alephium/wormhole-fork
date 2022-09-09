import WalletConnectClient, { CLIENT_EVENTS } from '@walletconnect/client'
import { PairingTypes } from '@walletconnect/types'
import WalletConnectProvider from '@alephium/walletconnect-provider'
import QRCodeModal from "@walletconnect/legacy-modal"
import { NodeProvider, Account, SignerProvider } from '@alephium/web3'
import { Context, createContext, ReactChildren, useCallback, useContext, useMemo, useState } from 'react'
import { ALEPHIUM_HOST, ALEPHIUM_NETWORK_ID } from '../utils/consts'
import { connect as connectToExtension, IAlephiumWindowObject } from '@alephium/get-alephium'

export enum ConnectType {
  WALLETCONNECT,
  WEBEXTENSION
}

export class AlephiumWalletSigner {
  signerProvider: SignerProvider
  account: Account
  nodeProvider: NodeProvider

  constructor(signerProvider: SignerProvider, account: Account) {
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
  const [alephiumWindowObject, setAlephiumWindowObject] = useState<IAlephiumWindowObject | undefined>(undefined)
  const [accounts, setAccounts] = useState<Account[]>([])
  const connect = useCallback(async (connectType: ConnectType) => {
    if (connectType === ConnectType.WALLETCONNECT) {
      const walletConnect = await WalletConnectClient.init({
        // TODO: configurable project Id
        projectId: '6e2562e43678dd68a9070a62b6d52207',
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
        chainGroup: -1, // -1 means all groups are acceptable
        client: walletConnect
      })

      walletConnect.on(CLIENT_EVENTS.pairing.proposal, async (proposal: PairingTypes.Proposal) => {
        const { uri } = proposal.signal.params
        setUri(uri)
        QRCodeModal.open(uri, () => {
          console.log("QR code modal closed")
        })
      })

      walletConnect.on(CLIENT_EVENTS.session.deleted, () => { })
      walletConnect.on(CLIENT_EVENTS.session.sync, () => {
        setUri(undefined)
      })

      provider.on('accountsChanged', (accounts: Account[]) => {
        setUri(undefined)
        setAccounts(accounts)
      })

      await provider.connect()
      setWalletConnectProvider(provider)
      QRCodeModal.close()
    } else if (connectType === ConnectType.WEBEXTENSION) {
      const windowAlephium = await connectToExtension({ include: ["alephium"] })
      if (typeof windowAlephium !== 'undefined') {
        await windowAlephium.enable()
        const accounts = await windowAlephium.getAccounts()
        setAccounts(accounts)
        setAlephiumWindowObject(windowAlephium)

        windowAlephium.on("addressesChanged", (accounts) => {
          setAccounts(accounts)
        })

        windowAlephium.on("networkChanged", (_networkId) => {
          windowAlephium.getAccounts().then((accounts) => {
            setAccounts(accounts)
          })
        })
      }
    }
  }, [])

  const disconnect = useCallback(async () => {
    await walletConnectProvider?.disconnect()
    setWalletConnectProvider(undefined)
    setAlephiumWindowObject(undefined)
    setAccounts([])
  }, [walletConnectProvider])

  const contextValue = useMemo(() => ({
    connect: connect,
    disconnect: disconnect,
    signer:
      walletConnectProvider
        ? new AlephiumWalletSigner(walletConnectProvider, accounts[0])
        : alephiumWindowObject
          ? new AlephiumWalletSigner(alephiumWindowObject, accounts[0])
          : undefined,
    uri: uri
  }), [
    connect,
    disconnect,
    walletConnectProvider,
    alephiumWindowObject,
    accounts,
    uri
  ])

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>
}

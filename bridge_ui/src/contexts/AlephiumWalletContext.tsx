import { CliqueClient, SingleAddressSigner, PrivateKeySigner } from 'alephium-web3'
import { Context, createContext, ReactChildren, useContext } from 'react'
import { ALEPHIUM_HOST } from '../utils/consts'

export interface AlephiumWallet {
    signer: SingleAddressSigner
    address: string
}

// @ts-ignore
export const WalletContext: Context<AlephiumWallet> = createContext<AlephiumWallet>()

export function useAlephiumWallet(): AlephiumWallet {
    return useContext(WalletContext)
}

// TODO: replace with walletconnect
export const AlephiumWalletProvider = ({
  children,
}: {
  children: ReactChildren;
}) => {
  const client = new CliqueClient({baseUrl: ALEPHIUM_HOST})
  // devnet test account signer
  const signer = new PrivateKeySigner(client, '0c493c4969b89003f964401752f29af896d0aa82d751d23abc1ee59bfe85f3ec')
  const wallet = {
    signer: signer,
    address: signer.address,
  }
  return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
}

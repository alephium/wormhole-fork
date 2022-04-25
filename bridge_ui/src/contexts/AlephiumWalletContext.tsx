import { Signer, CliqueClient } from 'alephium-web3'
import { Context, createContext, ReactChildren, useContext } from 'react'
import { ALEPHIUM_HOST } from '../utils/consts'

export interface AlephiumWallet {
    signer: Signer
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
    const signer = Signer.testSigner(client)
    const wallet = {
        signer: signer,
        address: signer.address
    }
    return <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
}

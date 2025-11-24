import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react'
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  SolletWalletAdapter,
  CloverWalletAdapter,
  Coin98WalletAdapter,
  SlopeWalletAdapter,
  SolongWalletAdapter,
  TorusWalletAdapter,
  SolletExtensionWalletAdapter,
  ExodusWalletAdapter
} from '@solana/wallet-adapter-wallets'
import { ReactNode, useMemo } from 'react'
import { getConst } from '../utils/consts'

export const SolanaWalletProvider = ({ children }: { children: ReactNode }) => {
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new SolletWalletAdapter(),
      new SolletExtensionWalletAdapter(),
      new CloverWalletAdapter(),
      new Coin98WalletAdapter(),
      new SlopeWalletAdapter(),
      new SolongWalletAdapter(),
      new TorusWalletAdapter(),
      new ExodusWalletAdapter()
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={getConst('SOLANA_HOST')}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  )
}

export const useSolanaWallet = useWallet

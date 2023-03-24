import { NodeProvider, SignerProvider, Address, groupOfAddress, web3 } from '@alephium/web3'
import { useEffect, useState } from 'react'
import { useAccount, useContext } from "@alephium/web3-react"

export class AlephiumWallet {
  signer: SignerProvider
  address: Address
  group: number
  nodeProvider: NodeProvider

  constructor(signerProvider: SignerProvider, nodeProvider: NodeProvider, address: Address) {
    this.signer = signerProvider
    this.address = address
    this.group = groupOfAddress(address)
    this.nodeProvider = nodeProvider
  }
}

export function useAlephiumWallet() {
  const context = useContext()
  const { account, isConnected } = useAccount()
  const [wallet, setWallet] = useState<AlephiumWallet | undefined>(undefined)

  useEffect(() => {
    if (isConnected && account !== undefined && context.signerProvider?.nodeProvider !== undefined) {
      const wallet = new AlephiumWallet(context.signerProvider, context.signerProvider.nodeProvider, account.address)
      web3.setCurrentNodeProvider(wallet.nodeProvider)
      setWallet(wallet)
      return
    }
    setWallet(undefined)
  }, [account, isConnected, context])

  return wallet
}

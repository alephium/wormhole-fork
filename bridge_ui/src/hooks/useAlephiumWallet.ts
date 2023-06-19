import { NodeProvider, SignerProvider, Address, groupOfAddress, web3 } from '@alephium/web3'
import { useEffect, useState } from 'react'
import { useAlephiumConnectContext } from "@alephium/web3-react"

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

  isExtensionWallet(): boolean {
    return typeof (this.signer as any)['request'] === 'function'
  }
}

export function useAlephiumWallet() {
  const context = useAlephiumConnectContext()
  const [wallet, setWallet] = useState<AlephiumWallet | undefined>(undefined)

  useEffect(() => {
    if (context.account !== undefined && context.signerProvider?.nodeProvider !== undefined) {
      const nodeProvider = new NodeProvider(context.signerProvider?.nodeProvider)
      const wallet = new AlephiumWallet(context.signerProvider, nodeProvider, context.account.address)
      web3.setCurrentNodeProvider(wallet.nodeProvider)
      setWallet(wallet)
      return
    }
    setWallet(undefined)
  }, [context])

  return wallet
}

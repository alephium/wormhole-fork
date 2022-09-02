import * as elliptic from 'elliptic'
import { Deployer, NetworkType } from "../lib/deployment"
import { zeroPad } from "../lib/utils"

const fromPublicKey = '03034a46d0028a725e27fd24b9142eef856f2ce01d590732744bde0d7553638cd6'
const toAddress = '199QZVT8bLkYNZ7d2xoHbip29yD18tdeHDPjB7cyx9ofi'
const ec = new elliptic.ec('secp256k1')
const fromPrivateKey = ec.keyFromPrivate('71d640c34b25eedd8acd60be136012f77059836c095fbd02a7cb86a124cbbdae')
const transferAmount = "1000000000000000"

function sign(txId: string): string {
    const sig = fromPrivateKey.sign(txId, {canonical: true})
    return zeroPad(sig.r.toString(16), 32) + zeroPad(sig.s.toString(16), 32)
}

const mine = async (deployer: Deployer, networkType: NetworkType): Promise<void> => {
  const txData = {
      fromPublicKey: fromPublicKey,
      destinations: [{
          address: toAddress,
          attoAlphAmount: transferAmount,
      }]
  }
  const tx = await deployer.provider.transactions.postTransactionsBuild(txData)
  const signature = sign(tx.txId)
  const signedTx = {
      unsignedTx: tx.unsignedTx,
      signature: signature
  }
  const submitResult = await deployer.provider.transactions.postTransactionsSubmit(signedTx)
  console.log("tx submitted, tx id: " + submitResult.txId)
  await new Promise(resolve => setTimeout(resolve, 1000))
  await mine(deployer, networkType)
}

export default mine

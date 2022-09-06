import { addressFromPublicKey } from "@alephium/web3"
import { PrivateKeySigner } from "../lib/deployment"

const fromPrivateKey = '71d640c34b25eedd8acd60be136012f77059836c095fbd02a7cb86a124cbbdae'
const fromPublicKey = '03034a46d0028a725e27fd24b9142eef856f2ce01d590732744bde0d7553638cd6'
const fromAddress = addressFromPublicKey(fromPublicKey)
const toAddress = '199QZVT8bLkYNZ7d2xoHbip29yD18tdeHDPjB7cyx9ofi'
const transferAmount = "1000000000000000"

async function mine(): Promise<void> {
  const signer = new PrivateKeySigner(fromPrivateKey)
  const result = await signer.signTransferTx({
    signerAddress: fromAddress,
    destinations: [{
        address: toAddress,
        attoAlphAmount: transferAmount
    }],
    submitTx: true
  })
  console.log("tx submitted, tx id: " + result.txId)
  await new Promise(resolve => setTimeout(resolve, 1000))
  await mine()
}

mine()

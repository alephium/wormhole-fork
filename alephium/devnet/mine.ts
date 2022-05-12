import { CliqueClient } from "alephium-web3"
import * as elliptic from 'elliptic'
import { zeroPad } from "../lib/utils"
import { dustAmount } from "./env"

const fromPublicKey = '03034a46d0028a725e27fd24b9142eef856f2ce01d590732744bde0d7553638cd6'
const toAddress = '199QZVT8bLkYNZ7d2xoHbip29yD18tdeHDPjB7cyx9ofi'
const ec = new elliptic.ec('secp256k1')
const fromPrivateKey = ec.keyFromPrivate('71d640c34b25eedd8acd60be136012f77059836c095fbd02a7cb86a124cbbdae')

function sign(txId: string): string {
    const sig = fromPrivateKey.sign(txId, {canonical: true})
    return zeroPad(sig.r.toString(16), 32) + zeroPad(sig.s.toString(16), 32)
}

export async function mine(client: CliqueClient) {
    const txData = {
        fromPublicKey: fromPublicKey,
        destinations: [{
            address: toAddress,
            alphAmount: dustAmount.toString(),
        }]
    }
    const tx = await client.transactions.postTransactionsBuild(txData)
    const signature = sign(tx.data.txId)
    const signedTx = {
        unsignedTx: tx.data.unsignedTx,
        signature: signature
    }
    const submitResult = await client.transactions.postTransactionsSubmit(signedTx)
    console.log("tx submitted, tx id: " + submitResult.data.txId)
    await new Promise(resolve => setTimeout(resolve, 5000))
    mine(client)
}

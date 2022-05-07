import { CliqueClient } from "alephium-web3"
import * as elliptic from 'elliptic'
import { zeroPad } from "../lib/utils"
import { dustAmount } from "./env"

const fromPublicKey = '0200ca8d57bae864ac717e4a2ebd6103f4c01f7dc6cbdf4d5f0b123f615794cdeb'
const toAddress = '14LQpKXvywkLQVrDAAZiLUYMe8epgCBUb3nh1ufwNVTh3'
const ec = new elliptic.ec('secp256k1')
const fromPrivateKey = ec.keyFromPrivate('75fd47c46e4ce23f88283303e2b8ae4b6238a7162c45aa04d78848ba314a70ee')

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

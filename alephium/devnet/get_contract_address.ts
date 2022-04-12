import { CliqueClient } from "alephium-web3"
import { Confirmed, TxStatus } from "alephium-web3/api/alephium"

function isConfirmed(txStatus: TxStatus): txStatus is Confirmed {
    return (txStatus as Confirmed).blockHash !== undefined
}

export async function getCreatedContractAddress(client: CliqueClient, txId: string): Promise<string> {
    const status = await client.transactions.getTransactionsStatus({txId: txId})
    if (!isConfirmed(status.data)) {
        console.log(txId + ' is not confirmed')
        await new Promise(r => setTimeout(r, 2000))
        return getCreatedContractAddress(client, txId)
    }

    const block = await client.blockflow.getBlockflowBlocksBlockHash(status.data.blockHash)
    const tx = block.data.transactions[status.data.txIndex]
    return tx.generatedOutputs[0].address
}

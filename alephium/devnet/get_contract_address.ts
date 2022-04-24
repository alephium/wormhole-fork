import { CliqueClient } from "alephium-web3"
import { waitTxConfirmed } from "../lib/utils"


export async function getCreatedContractAddress(client: CliqueClient, txId: string): Promise<string> {
    const confirmed = await waitTxConfirmed(client, txId)
    const block = await client.blockflow.getBlockflowBlocksBlockHash(confirmed.blockHash)
    const tx = block.data.transactions[confirmed.txIndex]
    return tx.generatedOutputs[0].address
}

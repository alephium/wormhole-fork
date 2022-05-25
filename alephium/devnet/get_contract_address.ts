import { NodeProvider } from "alephium-web3"
import { waitTxConfirmed } from "../lib/utils"


export async function getCreatedContractAddress(provider: NodeProvider, txId: string): Promise<string> {
    const confirmed = await waitTxConfirmed(provider, txId)
    const block = await provider.blockflow.getBlockflowBlocksBlockHash(confirmed.blockHash)
    const tx = block.transactions[confirmed.txIndex]
    return tx.generatedOutputs[0].address
}

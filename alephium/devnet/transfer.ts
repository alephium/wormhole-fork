import { CliqueClient, Script, Signer, SingleAddressSigner } from "alephium-web3";
import { nonce } from "../lib/utils";
import { consistencyLevel, messageFee } from "./env";

export async function getToken(
    client: CliqueClient,
    signer: SingleAddressSigner,
    tokenId: string,
    from: string,
    amount: bigint
): Promise<string> {
    const script = await Script.fromSource(client, 'get_token.ral')
    const scriptTx = await script.transactionForDeployment(signer, {
        templateVariables: {
            sender: from,
            amount: amount,
            tokenId: tokenId
        }
    })
    const result = await signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    return result.txId
}

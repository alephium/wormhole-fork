import { CliqueClient, Script, Signer } from "alephium-web3";
import { nonce } from "../lib/utils";
import { consistencyLevel, messageFee } from "./env";

export async function getToken(
    client: CliqueClient,
    signer: Signer,
    tokenId: string,
    from: string,
    amount: bigint
): Promise<string> {
    const script = await Script.fromSource(client, 'get_token.ral')
    const scriptTx = await script.transactionForDeployment(signer, {
        sender: from,
        amount: amount,
        tokenId: tokenId
    })
    const result = await signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    return result.txId
}

export async function transferLocal(
    client: CliqueClient,
    signer: Signer,
    tokenWrapperId: string,
    localTokenId: string,
    sender: string,
    toAddress: string,
    transferAmount: bigint,
    arbiterFee: bigint
): Promise<string> {
    const script = await Script.fromSource(client, 'transfer_local.ral')
    const scriptTx = await script.transactionForDeployment(signer, {
        sender: sender,
        tokenWrapperId: tokenWrapperId,
        localTokenId: localTokenId,
        toAddress: toAddress,
        tokenAmount: transferAmount,
        messageFee: messageFee,
        arbiterFee: arbiterFee,
        nonce: nonce(),
        consistencyLevel: consistencyLevel
    })
    const result = await signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    return result.txId
}
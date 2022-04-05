import { CliqueClient, Script, Signer } from "alephium-js";
import { nonce } from "../lib/utils";
import { consistencyLevel, messageFee } from "./env";

export async function getToken(
    client: CliqueClient,
    signer: Signer,
    tokenAddress: string,
    from: string,
    amount: bigint
): Promise<string> {
    const script = await Script.from(client, 'get_token.ral', {
        sender: from,
        amount: amount,
        tokenAddress: tokenAddress
    })
    const scriptTx = await script.transactionForDeployment(signer)
    const result = await signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    return result.txId
}

export async function transferLocal(
    client: CliqueClient,
    signer: Signer,
    tokenWrapperAddress: string,
    localTokenId: string,
    sender: string,
    toAddress: string,
    transferAmount: bigint,
    arbiterFee: bigint
): Promise<string> {
    const script = await Script.from(client, 'transfer_local.ral', {
        sender: sender,
        messageFee: messageFee,
        tokenId: localTokenId,
        tokenAmount: transferAmount,
        tokenWrapperAddress: tokenWrapperAddress,
        toAddress: toAddress,
        arbiterFee: arbiterFee,
        nonce: nonce(),
        consistencyLevel: consistencyLevel,
        distance: 64,
        tokenWrapperFactoryAddress: "",
        tokenWrapperCodeHash: "",
        tokenWrapperBinCode: "",
        tokenBridgeForChainBinCode: ""
    })
    const scriptTx = await script.transactionForDeployment(signer)
    const result = await signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    return result.txId
}
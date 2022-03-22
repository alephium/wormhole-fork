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

export async function transferNative(
    client: CliqueClient,
    signer: Signer,
    tokenBridgeForChainAddress: string,
    nativeTokenId: string,
    sender: string,
    toAddress: string,
    transferAmount: bigint,
    arbiterFee: bigint
): Promise<string> {
    const script = await Script.from(client, 'transfer_native.ral', {
        sender: sender,
        messageFee: messageFee,
        tokenId: nativeTokenId,
        tokenAmount: transferAmount,
        tokenBridgeForChainAddress: tokenBridgeForChainAddress,
        toAddress: toAddress,
        arbiterFee: arbiterFee,
        nonce: nonce(),
        consistencyLevel: consistencyLevel,
        serdeAddress: "00",
        tokenWrapperFactoryAddress: "00",
        tokenWrapperCodeHash: "00",
        tokenWrapperBinCode: "00",
        tokenBridgeForChainBinCode: "00",
        tokenBridgeForChainCodeHash: "00",
        sequenceCodeHash: "00"
    })
    const scriptTx = await script.transactionForDeployment(signer)
    const result = await signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    return result.txId
}
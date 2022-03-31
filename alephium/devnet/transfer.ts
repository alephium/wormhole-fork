import { CliqueClient, Script, Signer } from "alephium-js";
import { Confirmed, TxStatus } from "alephium-js/api/alephium";
import { nonce } from "../lib/utils";
import { consistencyLevel, messageFee } from "./env";
import { getCreatedContractAddress } from "./utils";

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

export async function createWrapper(
    client: CliqueClient,
    signer: Signer,
    tokenBridgeForChainAddress: string,
    nativeTokenId: string,
    payer: string,
    alphAmount: bigint
): Promise<string> {
    const script = await Script.from(client, 'create_wrapper.ral', {
        tokenBridgeForChainAddress: tokenBridgeForChainAddress,
        tokenId: nativeTokenId,
        payer: payer,
        alphAmount: alphAmount,
        tokenWrapperFactoryAddress: "00",
        tokenWrapperCodeHash: "00",
        tokenWrapperBinCode: "00",
        tokenBridgeForChainBinCode: "00"
    })
    const scriptTx = await script.transactionForDeployment(signer)
    const result = await signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    return getCreatedContractAddress(client, result.txId)
}

export async function transferNative(
    client: CliqueClient,
    signer: Signer,
    tokenWrapperAddress: string,
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
        tokenWrapperAddress: tokenWrapperAddress,
        toAddress: toAddress,
        arbiterFee: arbiterFee,
        nonce: nonce(),
        consistencyLevel: consistencyLevel,
        tokenWrapperFactoryAddress: "00",
        tokenWrapperCodeHash: "00",
        tokenWrapperBinCode: "00",
        tokenBridgeForChainBinCode: "00"
    })
    const scriptTx = await script.transactionForDeployment(signer)
    const result = await signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    return result.txId
}
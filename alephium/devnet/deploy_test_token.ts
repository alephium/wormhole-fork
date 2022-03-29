import { CliqueClient, Contract, Script, Signer } from 'alephium-js'
import * as env from './env'
import { toHex } from '../lib/utils'

export async function deployTestToken(client: CliqueClient, signer: Signer): Promise<string> {
    const textEncoder = new TextEncoder()
    const tokenSupply = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const initFields = [
        toHex(textEncoder.encode('test-token')).padStart(64, '0'), // symbol
        toHex(textEncoder.encode('test-token')).padStart(64, '0'), // name
        8, // decimals
        tokenSupply // supply
    ]

    const token = await Contract.from(client, 'token.ral')
    const deployTx = await token.transactionForDeployment(signer, initFields, tokenSupply.toString())
    const submitResult = await signer.submitTransaction(deployTx.unsignedTx, deployTx.txId)
    console.log('deploy token txId: ' + submitResult.txId + ', token contract address: ' + deployTx.contractAddress)
    return deployTx.contractAddress
}

export async function attestToken(
    client: CliqueClient,
    signer: Signer,
    tokenBridgeAddress: string,
    nonce: string,
    tokenId: string
): Promise<string> {
    const script = await Script.from(client, 'attest_token.ral', {
        payer: env.payer,
        messageFee: env.messageFee,
        tokenBridgeAddress: tokenBridgeAddress,
        tokenId: tokenId,
        nonce: nonce,
        consistencyLevel: env.consistencyLevel,
        tokenBridgeForChainBinCode: "00",
        tokenBridgeForChainCodeHash: "00",
        tokenWrapperCodeHash: "00"
    })
    const scriptTx = await script.transactionForDeployment(signer)
    const submitResult = await signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    console.log('attest token txId: ' + submitResult.txId)
    return submitResult.txId
}

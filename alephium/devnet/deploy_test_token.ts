import { CliqueClient, Contract, Script, Signer } from 'alephium-web3'
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

    const token = await Contract.fromSource(client, 'test_token.ral')
    const deployTx = await token.transactionForDeployment(signer, initFields, tokenSupply.toString())
    const submitResult = await signer.submitTransaction(deployTx.unsignedTx, deployTx.txId)
    console.log('deploy token txId: ' + submitResult.txId + ', token contract id: ' + deployTx.contractId)
    return deployTx.contractId
}

export async function attestToken(
    client: CliqueClient,
    signer: Signer,
    tokenBridgeId: string,
    nonce: string,
    tokenId: string
): Promise<string> {
    const script = await Script.fromSource(client, 'attest_token.ral')
    const scriptTx = await script.transactionForDeployment(signer, {
        payer: env.payer,
        messageFee: env.messageFee,
        tokenBridgeId: tokenBridgeId,
        tokenId: tokenId,
        nonce: nonce,
        consistencyLevel: env.consistencyLevel
    })
    const submitResult = await signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    console.log('attest token txId: ' + submitResult.txId)
    return submitResult.txId
}

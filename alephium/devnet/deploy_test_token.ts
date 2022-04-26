import { CliqueClient, Contract, Signer } from 'alephium-web3'
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

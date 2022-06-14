import { NodeProvider, Contract, NodeWallet } from '@alephium/web3'
import { toHex } from '../lib/utils'

export async function deployTestToken(provider: NodeProvider, signer: NodeWallet): Promise<string> {
    const textEncoder = new TextEncoder()
    const tokenSupply = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const initFields = {
        "symbol_": toHex(textEncoder.encode('test-token')).padStart(64, '0'), // symbol
        "name_": toHex(textEncoder.encode('test-token')).padStart(64, '0'), // name
        "decimals_": 8, // decimals
        "totalSupply_": tokenSupply // supply
    }

    const token = await Contract.fromSource(provider, 'test_token.ral')
    const deployTx = await token.transactionForDeployment(signer, {
        initialFields: initFields,
        issueTokenAmount: tokenSupply.toString()
    })
    const submitResult = await signer.submitTransaction(deployTx.unsignedTx, deployTx.txId)
    console.log(
        'deploy token txId: ' + submitResult.txId +
        ', token contract id: ' + deployTx.contractId +
        ', token address: ' + deployTx.contractAddress
    )
    return deployTx.contractId
}

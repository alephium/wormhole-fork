import { NodeProvider, NodeWallet } from '@alephium/web3'
import { compileContract } from '../lib/utils'

export async function deployTestToken(provider: NodeProvider, signer: NodeWallet): Promise<string> {
    const tokenSupply = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const token = await compileContract(provider, 'tests/test_token.ral')
    const deployTx = await token.transactionForDeployment(signer, {
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

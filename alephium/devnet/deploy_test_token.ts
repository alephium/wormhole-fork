import { Contract, NodeWallet } from '@alephium/web3'

export async function deployTestToken(signer: NodeWallet): Promise<string> {
    const tokenSupply = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const token = await Contract.fromSource('tests/test_token.ral')
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

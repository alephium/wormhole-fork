import { binToHex, NodeProvider, contractIdFromAddress, Script, NodeWallet } from 'alephium-web3'
import { testWallet } from 'alephium-web3/test'
import { Wormhole } from '../lib/wormhole'
import { registerChains } from './register_chains'
import * as env from './env'
import { deployTestToken } from './deploy_test_token'
import { getCreatedContractAddress } from './get_contract_address'
import { mine } from './mine'

const provider = new NodeProvider("http://localhost:22973")

async function createWallet() {
    const wallets = await provider.wallets.getWallets()
    const exists = wallets.some(status => status.walletName == env.testWalletName)
    if (exists) {
        console.log('test wallet already exists')
        await provider.wallets.postWalletsWalletNameUnlock(env.testWalletName, { password: env.testWalletPassword })
        return
    }

    await provider.wallets.putWallets({
        walletName: env.testWalletName,
        mnemonic: env.testWalletMnemonic,
        password: env.testWalletPassword
    })
    console.log('create test wallet succeed')
}

async function createTokenWrapper(
    wormhole: Wormhole,
    localTokenId: string,
    tokenBridgeForChainId: string,
    remoteChain: string
) {
    let txId = await wormhole.createWrapperForLocalToken(tokenBridgeForChainId, localTokenId, env.payer, env.dustAmount)
    let tokenWrapper = await getCreatedContractAddress(provider, txId)
    const tokenWrapperId = binToHex(contractIdFromAddress(tokenWrapper))
    console.log('token wrapper id for ' + remoteChain + ': ' + tokenWrapperId)
}

async function getToken(
    provider: NodeProvider,
    signer: NodeWallet,
    tokenId: string,
    from: string,
    amount: bigint
): Promise<string> {
    const script = await Script.fromSource(provider, 'get_token.ral')
    const scriptTx = await script.transactionForDeployment(signer, {
        initialFields: {
            sender: from,
            amount: amount,
            tokenId: tokenId
        }
    })
    const result = await signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
    return result.txId
}

async function deploy() {
    await createWallet()

    const signer = await testWallet(provider)
    const wormhole = new Wormhole(
        provider,
        signer,
        env.governanceChainId,
        env.governanceContractAddress,
        env.governanceChainId,
        env.governanceContractAddress,
        env.initGuardianSet,
        env.initGuardianIndex,
        env.messageFee
    )

    const contracts = await wormhole.deployContracts()
    console.log("wormhole contracts: " + JSON.stringify(contracts, null, 2))
    const remoteChains = await registerChains(wormhole, contracts.tokenBridge.contractId)
    console.log("remote chains: " + JSON.stringify(remoteChains, null, 2))
    const testTokenId = await deployTestToken(provider, signer)
    console.log("local token id: " + testTokenId)

    const tokenAmount = env.oneAlph * 10n
    const getTokenTxId = await getToken(provider, signer, testTokenId, env.payer, tokenAmount)
    console.log('get token txId: ' + getTokenTxId)

    await createTokenWrapper(wormhole, testTokenId, remoteChains.eth, "eth")
    await createTokenWrapper(wormhole, testTokenId, remoteChains.bsc, "bsc")

    // start auto mining, used for check confirmations
    mine(provider)
}

deploy()

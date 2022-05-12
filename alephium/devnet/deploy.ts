import { binToHex, CliqueClient, contractIdFromAddress, NodeSigner, Script, SingleAddressSigner } from 'alephium-web3'
import { Wormhole } from '../lib/wormhole'
import { registerChains } from './register_chains'
import * as env from './env'
import { deployTestToken } from './deploy_test_token'
import { getCreatedContractAddress } from './get_contract_address'
import { mine } from './mine'

if (process.argv.length < 3) {
    throw Error('invalid args, expect rpc port arg')
}

const port = process.argv[2]
const client = new CliqueClient({baseUrl: `http://127.0.0.1:${port}`})

async function createWallet() {
    const testWallet = 'alephium-web3-test-only-wallet'
    const wallets = await client.wallets.getWallets()
    const exists = wallets.data.some(status => status.walletName == testWallet)
    if (exists) {
        console.log('test wallet already exists')
        return
    }

    const password = 'alph'
    const mnemonic = 'vault alarm sad mass witness property virus style good flower rice alpha viable evidence run glare pretty scout evil judge enroll refuse another lava'
    await client.wallets.putWallets({
        walletName: testWallet,
        mnemonic: mnemonic,
        password: password
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
    let tokenWrapper = await getCreatedContractAddress(client, txId)
    const tokenWrapperId = binToHex(contractIdFromAddress(tokenWrapper))
    console.log('token wrapper id for ' + remoteChain + ': ' + tokenWrapperId)
}

async function getToken(
    client: CliqueClient,
    signer: SingleAddressSigner,
    tokenId: string,
    from: string,
    amount: bigint
): Promise<string> {
    const script = await Script.fromSource(client, 'get_token.ral')
    const scriptTx = await script.transactionForDeployment(signer, {
        templateVariables: {
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

    const signer = await NodeSigner.testSigner(client)
    const wormhole = new Wormhole(
        client,
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
    const testTokenId = await deployTestToken(client, signer)
    console.log("local token id: " + testTokenId)

    const tokenAmount = env.oneAlph * 10n
    const getTokenTxId = await getToken(client, signer, testTokenId, env.payer, tokenAmount)
    console.log('get token txId: ' + getTokenTxId)

    await createTokenWrapper(wormhole, testTokenId, remoteChains.eth, "eth")
    await createTokenWrapper(wormhole, testTokenId, remoteChains.terra, "terra")
    await createTokenWrapper(wormhole, testTokenId, remoteChains.bsc, "bsc")

    // start auto mining, used for check confirmations
    mine(client)
}

deploy()

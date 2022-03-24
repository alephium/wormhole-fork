import { CliqueClient, Signer } from 'alephium-js'
import { Wormhole } from '../lib/wormhole'
import { registerChains } from './register_chains'
import * as env from './env'
import { attestToken, deployTestToken } from './deploy_test_token'
import { nonce } from '../lib/utils'
import { getToken, transferNative } from './transfer'

if (process.argv.length < 3) {
    throw Error('invalid args, expect rpc port arg')
}

const port = process.argv[2]
const client = new CliqueClient({baseUrl: `http://127.0.0.1:${port}`})
const signer = Signer.testSigner(client)
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

async function createWallet() {
    const testWallet = 'alephium-js-test-only-wallet'
    const wallets = await client.wallets.getWallets()
    const exists = wallets.data.some(status => status.walletName == testWallet)
    if (exists) {
        console.log('test wallet already exists')
        return
    }

    const password = 'alph'
    const mnemonic = 'vault vault vault vault vault vault vault vault vault vault vault vault vault vault vault vault vault vault vault vault vault vault vault vault'
    await client.wallets.putWallets({
        walletName: testWallet,
        mnemonic: mnemonic,
        password: password
    })
    console.log('create test wallet succeed')
}

async function deploy() {
    await createWallet()

    const contracts = await wormhole.deployContracts()
    console.log("wormhole contracts: " + JSON.stringify(contracts, null, 2))
    const remoteChains = await registerChains(wormhole, contracts.tokenBridge.address)
    console.log("remote chains: " + JSON.stringify(remoteChains, null, 2))
    const testToken = await deployTestToken(client, signer)
    await attestToken(
        client, signer, contracts.tokenBridge.address, nonce(), testToken
    )

    const tokenAmount = env.oneAlph * 10n
    const getTokenId = await getToken(client, signer, testToken, env.payer, tokenAmount)
    console.log('get token txId: ' + getTokenId)

    // transfer to eth
    const transferAmount = env.oneAlph * 5n
    const arbiterFee = env.messageFee
    // privateKey: 89dd2124dd1366f30bc5edfa9025f56e1aaa56d0a7786181df43aa8ee2520c9d
    const receiver = '0d0F183465284CB5cb426902445860456ed59b34'
    const transferNativeId = await transferNative(
        client,
        signer,
        remoteChains.eth,
        testToken,
        env.payer,
        receiver.padStart(64, '0'),
        transferAmount,
        arbiterFee
    )
    console.log('transfer native token txId: ' + transferNativeId)
}

deploy()

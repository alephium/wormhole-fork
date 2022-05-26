import { binToHex, NodeProvider, contractIdFromAddress, Script, NodeWallet } from 'alephium-web3'
import { testWallet } from 'alephium-web3/test'
import { Wormhole } from '../lib/wormhole'
import { registerChains } from './register_chains'
import { deployTestToken } from './deploy_test_token'
import { getCreatedContractAddress } from './get_contract_address'
import { mine } from './mine'
import * as consts from './consts'
import * as dotenv from "dotenv"

dotenv.config({ path: __dirname+'/../../.env' })

const provider = new NodeProvider("http://localhost:22973")

async function createWallet() {
    const wallets = await provider.wallets.getWallets()
    const exists = wallets.some(status => status.walletName == consts.testWalletName)
    if (exists) {
        console.log('test wallet already exists')
        await provider.wallets.postWalletsWalletNameUnlock(consts.testWalletName, { password: consts.testWalletPassword })
        return
    }

    await provider.wallets.putWallets({
        walletName: consts.testWalletName,
        mnemonic: consts.testWalletMnemonic,
        password: consts.testWalletPassword
    })
    console.log('create test wallet succeed')
}

async function createTokenWrapper(
    wormhole: Wormhole,
    localTokenId: string,
    tokenBridgeForChainId: string,
    remoteChain: string
) {
    let txId = await wormhole.createWrapperForLocalToken(tokenBridgeForChainId, localTokenId, consts.payer, consts.dustAmount)
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
    const initGuardianSet = JSON.parse(process.env.INIT_SIGNERS!) as string[]
    const wormhole = new Wormhole(
        provider,
        signer,
        parseInt(process.env.INIT_CHAIN_ID!),
        parseInt(process.env.INIT_GOV_CHAIN_ID!),
        process.env.INIT_GOV_CONTRACT!,
        parseInt(process.env.BRIDGE_INIT_GOV_CHAIN_ID!),
        process.env.BRIDGE_INIT_GOV_CONTRACT!,
        initGuardianSet,
        0,
        consts.messageFee
    )

    const contracts = await wormhole.deployContracts()
    console.log("wormhole contracts: " + JSON.stringify(contracts, null, 2))
    const remoteChains = await registerChains(wormhole, contracts.tokenBridge.contractId)
    console.log("remote chains: " + JSON.stringify(remoteChains, null, 2))
    const testTokenId = await deployTestToken(provider, signer)
    console.log("local token id: " + testTokenId)

    const tokenAmount = consts.oneAlph * 10n
    const getTokenTxId = await getToken(provider, signer, testTokenId, consts.payer, tokenAmount)
    console.log('get token txId: ' + getTokenTxId)

    await createTokenWrapper(wormhole, testTokenId, remoteChains.eth, "eth")
    await createTokenWrapper(wormhole, testTokenId, remoteChains.bsc, "bsc")

    // start auto mining, used for check confirmations
    mine(provider)
}

deploy()

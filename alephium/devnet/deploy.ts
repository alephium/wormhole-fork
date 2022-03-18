import { CliqueClient, Signer } from 'alephium-js'
import { Wormhole } from '../lib/wormhole'
import { registerChains } from './register_chains'
import * as env from './env'
import { attestToken, deployTestToken } from './deploy_test_token'
import { randomBytes } from 'crypto'
import { toHex } from '../lib/utils'

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
    env.governanceChainAddress,
    env.governanceChainId,
    env.governanceChainAddress,
    env.initGuardianSet,
    env.initGuardianIndex,
    env.messageFee
)

function nonce(): string {
    const bytes = randomBytes(4)
    return toHex(bytes)
}

async function deploy() {
    const contracts = await wormhole.deployContracts()
    console.log("wormhole contracts: " + JSON.stringify(contracts, null, 2))
    const remoteChains = await registerChains(wormhole, contracts.tokenBridge.address)
    console.log("remote chains: " + JSON.stringify(remoteChains, null, 2))
    const testToken = await deployTestToken(client, signer)
    await attestToken(
        client, signer, contracts.tokenBridge.address, nonce(), testToken
    )
}

deploy()

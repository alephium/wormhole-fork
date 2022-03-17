import { CliqueClient, Signer } from 'alephium-js'
import { Wormhole } from '../lib/wormhole'

if (process.argv.length < 3) {
    throw Error('invalid args, expect rpc port arg')
}

const port = process.argv[2]
const governanceChainId = 1
const governanceChainAddress = '0000000000000000000000000000000000000000000000000000000000000004'

const client = new CliqueClient({baseUrl: `http://127.0.0.1:${port}`})
const initGuardianSet = ["beFA429d57cD18b7F8A4d91A2da9AB4AF05d0FBe"]
const initGuardianIndex = 0
const wormhole = new Wormhole(
    client,
    Signer.testSigner(client),
    governanceChainId,
    governanceChainAddress,
    governanceChainId,
    governanceChainAddress,
    initGuardianSet,
    initGuardianIndex
)
wormhole.deployContracts().then(
    res => console.log(res),
    error => console.log('error: ' + JSON.stringify(error))
)

// governance: 2AiLoHmb7C7a54z4wvQ6o35aHr7y8oPnN9q5t3KjpvBvY
// tokenBridge: 2A4W7j8kN1maGDg3xxK8eJ8Ra3XNsfg6UhPfgJ3wEs2i2
// tokenWrapperFactory: 2AqKqXdCeUtQKEX35xRSwPd8rGZWBRcUCeLwXaFArctk7

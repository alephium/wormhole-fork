import { CliqueClient, InputAsset } from 'alephium-js'
import { nonce, toHex } from '../lib/utils'
import { governanceChainId, governanceContractAddress, initGuardianSet, messageFee } from './fixtures/governance-fixture'
import { AttestToken, createTestToken, createTokenBridge, createTokenBridgeForChain, RegisterChain, Transfer } from './fixtures/token-bridge-fixture'
import { alphChainId, dustAmount, oneAlph, randomAssetAddress, randomContractAddress, toContractId, VAABody } from './fixtures/wormhole-fixture'
import { randomBytes } from 'crypto'

describe("test token bridge", () => {
    const client = new CliqueClient({baseUrl: `http://127.0.0.1:22973`})

    const payer = randomAssetAddress()
    const inputAsset: InputAsset = {
        address: payer,
        asset: {
            alphAmount: oneAlph * 4n
        }
    }

    it('should attest token', async () => {
        const tokenBridgeInfo = await createTokenBridge(client)
        const tokenBridge = tokenBridgeInfo.contract
        const testToken = await createTestToken(client)
        const nonceHex = nonce()
        const testResult = await tokenBridge.test(client, 'attestToken', {
            address: tokenBridgeInfo.address,
            initialFields: tokenBridgeInfo.selfState.fields,
            testArgs: [payer, testToken.address, nonceHex, 0],
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeInfo.dependencies.concat(testToken.states())
        })
        const governanceOutput = testResult.txOutputs[0]
        expect(governanceOutput.address).toEqual(tokenBridgeInfo.dependencies[1].address)
        expect(governanceOutput.alphAmount).toEqual(Number(dustAmount + messageFee))

        const message = new AttestToken(
            toContractId(testToken.address),
            testToken.selfState.fields[0] as string,
            testToken.selfState.fields[1] as string,
            testToken.selfState.fields[2] as number,
        )
        const events = testResult.events
        expect(events.length).toEqual(1)
        expect(events[0].name).toEqual('WormholeMessage')
        expect(events[0].fields).toEqual([
            toContractId(tokenBridgeInfo.address),
            0,
            nonceHex + toHex(message.encode()),
            0
        ])
    })

    it('should register chain', async () => {
        const tokenBridgeInfo = await createTokenBridge(client)
        const tokenBridge = tokenBridgeInfo.contract
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const registerChain = new RegisterChain(alphChainId, alphChainId + 1, remoteTokenBridgeId)
        const vaaBody = new VAABody(registerChain.encode(), governanceChainId, governanceContractAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const testResult = await tokenBridge.test(client, 'registerChain', {
            address: tokenBridgeInfo.address,
            initialFields: tokenBridgeInfo.selfState.fields,
            testArgs: [toHex(vaa.encode()), payer, dustAmount],
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeInfo.dependencies
        })

        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0]
        expect(event.fields.length).toEqual(1)
        expect(event.name).toEqual("ContractCreated")
        expect(event.contractAddress).toEqual(tokenBridgeInfo.address)
        const tokenBridgeForChainAddress = event.fields[0] as string

        const output = testResult.txOutputs[0]
        expect(output.address).toEqual(tokenBridgeForChainAddress)
        expect(output.alphAmount).toEqual(Number(dustAmount))
    })

    it('should transfer native token', async () => {
        const remoteChainId = alphChainId + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const tokenBridgeInfo = await createTokenBridge(client)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            client,
            tokenBridgeInfo,
            remoteChainId,
            remoteTokenBridgeId
        )
        const tokenBridgeForChain = tokenBridgeForChainInfo.contract
        const testTokenInfo = await createTestToken(client)
        const recipient = toHex(randomBytes(32))
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const nonceHex = nonce()
        const inputAsset: InputAsset = {
            address: payer,
            asset: {
                alphAmount: oneAlph * 4n,
                tokens: [{
                    id: toContractId(testTokenInfo.address),
                    amount: transferAmount * 2n
                }]
            }
        }
        const testResult = await tokenBridgeForChain.test(client, 'transferNative', {
            address: tokenBridgeForChainInfo.address,
            initialFields: tokenBridgeForChainInfo.selfState.fields,
            testArgs: [payer, testTokenInfo.address, payer, recipient, transferAmount, arbiterFee, nonceHex, 0],
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeInfo.states().concat(testTokenInfo.states())
        })

        const tokenBridgeForChainOutput = testResult.txOutputs[0]
        expect(tokenBridgeForChainOutput.tokens).toEqual([{
            id: toContractId(testTokenInfo.address),
            amount: transferAmount
        }])
        const governanceOutput = testResult.txOutputs[1]
        expect(governanceOutput.alphAmount).toEqual(Number(dustAmount + messageFee))

        const transferMessage = new Transfer(
            transferAmount,
            toContractId(testTokenInfo.address),
            alphChainId,
            recipient,
            remoteChainId,
            arbiterFee
        )
        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0]
        expect(event.name).toEqual('WormholeMessage')

        let postfix = Buffer.allocUnsafe(33)
        postfix.writeUint8(1, 0)
        postfix.write(toContractId(tokenBridgeForChainInfo.address), 1, 'hex')

        expect(event.fields).toEqual([
            toContractId(tokenBridgeInfo.address),
            0,
            nonceHex + toHex(transferMessage.encode()) + toHex(postfix),
            0
        ])
    })

})

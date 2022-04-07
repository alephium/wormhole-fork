import { Asset, CliqueClient, ContractEvent, InputAsset } from 'alephium-web3'
import { nonce, toHex } from '../lib/utils'
import { governanceChainId, governanceContractAddress, initGuardianSet, messageFee } from './fixtures/governance-fixture'
import { AttestToken, createTestToken, createTokenBridge, createTokenBridgeForChain, createWrapper, RegisterChain, Transfer } from './fixtures/token-bridge-fixture'
import { alphChainId, dustAmount, oneAlph, randomAssetAddress, toContractId, toRecipientId, u256Max, VAABody } from './fixtures/wormhole-fixture'
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

    const decimals = 8
    const symbol = toHex(randomBytes(32))
    const name = toHex(randomBytes(32))

    it('should attest token', async () => {
        const tokenBridgeInfo = await createTokenBridge(client)
        const tokenBridge = tokenBridgeInfo.contract
        const testToken = await createTestToken(client, decimals, symbol, name)
        const nonceHex = nonce()
        const testResult = await tokenBridge.testPublicMethod(client, 'attestToken', {
            address: tokenBridgeInfo.address,
            initialFields: tokenBridgeInfo.selfState.fields,
            testArgs: [payer, testToken.address, nonceHex, 0],
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeInfo.dependencies.concat(testToken.states())
        })
        const governanceOutput = testResult.txOutputs[0]
        expect(governanceOutput.address).toEqual(tokenBridgeInfo.governance.address)
        expect(governanceOutput.alphAmount).toEqual(Number(dustAmount + messageFee))

        const message = new AttestToken(
            toContractId(testToken.address),
            alphChainId,
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
        const testResult = await tokenBridge.testPublicMethod(client, 'registerChain', {
            address: tokenBridgeInfo.address,
            initialFields: tokenBridgeInfo.selfState.fields,
            testArgs: [toHex(vaa.encode()), payer, dustAmount],
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeInfo.dependencies
        })

        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0] as ContractEvent
        expect(event.fields.length).toEqual(1)
        expect(event.name).toEqual("ContractCreated")
        expect(event.contractAddress).toEqual(tokenBridgeInfo.address)
        const tokenBridgeForChainAddress = event.fields[0] as string

        const output = testResult.txOutputs[0]
        expect(output.address).toEqual(tokenBridgeForChainAddress)
        expect(output.alphAmount).toEqual(Number(dustAmount))
    })

    it('should create token wrapper for local token', async () => {
        const remoteChainId = alphChainId + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const tokenBridgeInfo = await createTokenBridge(client)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const testToken = await createTestToken(client, decimals, symbol, name)
        const tokenBridgeForChain = tokenBridgeForChainInfo.contract
        const testResult = await tokenBridgeForChain.testPublicMethod(client, 'createWrapperForLocalToken', {
            address: tokenBridgeForChainInfo.address,
            initialFields: tokenBridgeForChainInfo.selfState.fields,
            testArgs: [testToken.address, payer, dustAmount],
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeForChainInfo.dependencies.concat(testToken.states())
        })

        const tokenWrapperOutput = testResult.txOutputs[0]
        expect(tokenWrapperOutput.alphAmount).toEqual(Number(dustAmount))
        expect(tokenWrapperOutput.tokens).toEqual([])

        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0] as ContractEvent
        expect(event.name).toEqual('ContractCreated')
        expect(event.contractAddress).toEqual(tokenBridgeInfo.tokenWrapperFactory.address)
        expect(event.fields).toEqual([tokenWrapperOutput.address])
    })

    it('should transfer local token', async () => {
        const remoteChainId = alphChainId + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const tokenBridgeInfo = await createTokenBridge(client)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const testTokenInfo = await createTestToken(client, decimals, symbol, name)
        const tokenWrapperInfo = await createWrapper(
            testTokenInfo.address, true, decimals, symbol, name, tokenBridgeInfo, tokenBridgeForChainInfo
        )
        const fromAddress = randomAssetAddress()
        const toAddress = toHex(randomBytes(32))
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const nonceHex = nonce()
        const inputAsset: InputAsset = {
            address: fromAddress,
            asset: {
                alphAmount: oneAlph * 4n,
                tokens: [{
                    id: toContractId(testTokenInfo.address),
                    amount: transferAmount * 2n
                }]
            }
        }
        const tokenWrapper = tokenWrapperInfo.contract
        const testResult = await tokenWrapper.testPublicMethod(client, 'transfer', {
            address: tokenWrapperInfo.address,
            initialFields: tokenWrapperInfo.selfState.fields,
            testArgs: [fromAddress, toAddress, transferAmount, arbiterFee, nonceHex, 0],
            inputAssets: [inputAsset],
            existingContracts: tokenWrapperInfo.dependencies.concat(testTokenInfo.states())
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
            toAddress,
            remoteChainId,
            arbiterFee
        )
        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0]
        expect(event.name).toEqual('WormholeMessage')

        let postfix = Buffer.allocUnsafe(33)
        postfix.writeUint8(1, 0)
        postfix.write(toContractId(tokenWrapperInfo.address), 1, 'hex')

        expect(event.fields).toEqual([
            toContractId(tokenBridgeInfo.address),
            0,
            nonceHex + toHex(transferMessage.encode()) + toHex(postfix),
            0
        ])
    })

    it('should complete local token transfer', async () => {
        const remoteChainId = alphChainId + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const tokenBridgeInfo = await createTokenBridge(client)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const testTokenInfo = await createTestToken(client, decimals, symbol, name)
        const tokenWrapperInfo = await createWrapper(
            testTokenInfo.address, true, decimals, symbol, name, tokenBridgeInfo, tokenBridgeForChainInfo
        )
        const toAddress = randomAssetAddress()
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const transfer = new Transfer(
            transferAmount, toContractId(testTokenInfo.address), alphChainId, toRecipientId(toAddress), alphChainId, arbiterFee
        )
        const vaaBody = new VAABody(transfer.encode(), remoteChainId, remoteTokenBridgeId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const initTokenAmount = transferAmount * 2n
        const initAsset: Asset = {
            alphAmount: oneAlph,
            tokens: [{
                id: toContractId(testTokenInfo.address),
                amount: initTokenAmount
            }]
        }
        const arbiter = randomAssetAddress()
        const arbiterInputAsset: InputAsset = {
            address: arbiter,
            asset: {alphAmount: dustAmount}
        }
        const tokenWrapper = tokenWrapperInfo.contract
        const testResult = await tokenWrapper.testPublicMethod(client, 'completeTransfer', {
            address: tokenWrapperInfo.address,
            initialFields: tokenWrapperInfo.selfState.fields,
            testArgs: [toHex(vaa.encode()), arbiter],
            initialAsset: initAsset,
            inputAssets: [inputAsset, arbiterInputAsset],
            existingContracts: tokenWrapperInfo.dependencies.concat(testTokenInfo.states())
        })

        const recipientOutput = testResult.txOutputs[0]
        expect(recipientOutput.address).toEqual(toAddress)
        expect(recipientOutput.alphAmount).toEqual(Number(dustAmount))
        expect(recipientOutput.tokens).toEqual([{
            id: toContractId(testTokenInfo.address),
            amount: transferAmount - arbiterFee
        }])

        const arbiterOutput = testResult.txOutputs[1]
        expect(arbiterOutput.address).toEqual(arbiter)
        expect(arbiterOutput.alphAmount).toEqual(Number(dustAmount))
        expect(arbiterOutput.tokens).toEqual([{
            id: toContractId(testTokenInfo.address),
            amount: Number(arbiterFee)
        }])

        const contractOutput = testResult.txOutputs[2]
        expect(contractOutput.address).toEqual(tokenWrapperInfo.address)
        expect(contractOutput.alphAmount).toEqual((initAsset.alphAmount as bigint) - dustAmount)
        expect(contractOutput.tokens).toEqual([{
            id: toContractId(testTokenInfo.address),
            amount: initTokenAmount - transferAmount
        }])
    })

    it('should create token wrapper for remote token', async () => {
        const remoteChainId = alphChainId + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const tokenBridgeInfo = await createTokenBridge(client)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const remoteTokenId = toHex(randomBytes(32))
        const attestToken = new AttestToken(remoteTokenId, remoteChainId, symbol, name, decimals)
        const vaaBody = new VAABody(attestToken.encode(), remoteChainId, remoteTokenBridgeId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const tokenBridgeForChain = tokenBridgeForChainInfo.contract
        const testResult = await tokenBridgeForChain.testPublicMethod(client, 'createWrapperForRemoteToken', {
            address: tokenBridgeForChainInfo.address,
            initialFields: tokenBridgeForChainInfo.selfState.fields,
            testArgs: [toHex(vaa.encode()), payer, dustAmount],
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeForChainInfo.dependencies
        })

        const tokenWrapperOutput = testResult.txOutputs[0]
        expect(tokenWrapperOutput.alphAmount).toEqual(Number(dustAmount))
        const tokenWrapperId = toContractId(tokenWrapperOutput.address)
        expect(tokenWrapperOutput.tokens).toEqual([{
            id: tokenWrapperId,
            amount: u256Max
        }])

        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0] as ContractEvent
        expect(event.name).toEqual('ContractCreated')
        expect(event.contractAddress).toEqual(tokenBridgeInfo.tokenWrapperFactory.address)
        expect(event.fields).toEqual([tokenWrapperOutput.address])
    })

    it('should transfer wrapped token', async () => {
        const remoteChainId = alphChainId + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const tokenBridgeInfo = await createTokenBridge(client)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const wrappedTokenId = toHex(randomBytes(32))
        const tokenWrapperInfo = await createWrapper(
            wrappedTokenId, false, decimals, symbol,
            name, tokenBridgeInfo, tokenBridgeForChainInfo
        )
        const tokenWrapperContract = tokenWrapperInfo.contract
        const fromAddress = randomAssetAddress()
        const toAddress = toHex(randomBytes(32))
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const nonceHex = nonce()
        const inputAsset: InputAsset = {
            address: fromAddress,
            asset: {
                alphAmount: oneAlph * 4n,
                tokens: [{
                    id: toContractId(tokenWrapperInfo.address),
                    amount: transferAmount * 2n
                }]
            }
        }
        const testResult = await tokenWrapperContract.testPublicMethod(client, 'transfer', {
            address: tokenWrapperInfo.address,
            initialFields: tokenWrapperInfo.selfState.fields,
            testArgs: [fromAddress, toAddress, transferAmount, arbiterFee, nonceHex, 0],
            inputAssets: [inputAsset],
            existingContracts: tokenWrapperInfo.dependencies
        })

        const tokenWrapperOutput = testResult.txOutputs[0]
        expect(tokenWrapperOutput.tokens).toEqual([{
            id: toContractId(tokenWrapperInfo.address),
            amount: transferAmount
        }])

        const governanceOutput = testResult.txOutputs[1]
        expect(governanceOutput.alphAmount).toEqual(Number(dustAmount + messageFee))

        const transfer = new Transfer(
            transferAmount,
            wrappedTokenId,
            remoteChainId,
            toAddress,
            remoteChainId,
            arbiterFee
        )
        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0]
        expect(event.name).toEqual('WormholeMessage')

        let postfix = Buffer.allocUnsafe(33)
        postfix.writeUint8(0, 0)
        postfix.write(toContractId(tokenWrapperInfo.address), 1, 'hex')

        expect(event.fields).toEqual([
            toContractId(tokenBridgeInfo.address),
            0,
            nonceHex + toHex(transfer.encode()) + toHex(postfix),
            0
        ])
    })

    it('should complete wrapped token transfer', async () => {
        const remoteChainId = alphChainId + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const tokenBridgeInfo = await createTokenBridge(client)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const wrappedTokenId = toHex(randomBytes(32))
        const tokenWrapperInfo = await createWrapper(
            wrappedTokenId, false, decimals, symbol,
            name, tokenBridgeInfo, tokenBridgeForChainInfo
        )
        const toAddress = randomAssetAddress()
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const transfer = new Transfer(
            transferAmount, wrappedTokenId, remoteChainId, toRecipientId(toAddress), alphChainId, arbiterFee
        )
        const vaaBody = new VAABody(transfer.encode(), remoteChainId, remoteTokenBridgeId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const initTokenAmount = transferAmount * 2n
        const initAsset: Asset = {
            alphAmount: oneAlph,
            tokens: [{
                id: toContractId(tokenWrapperInfo.address),
                amount: initTokenAmount
            }]
        }
        const arbiter = randomAssetAddress()
        const arbiterInputAsset: InputAsset = {
            address: arbiter,
            asset: {alphAmount: dustAmount}
        }
        const tokenWrapper = tokenWrapperInfo.contract
        const testResult = await tokenWrapper.testPublicMethod(client, 'completeTransfer', {
            address: tokenWrapperInfo.address,
            initialFields: tokenWrapperInfo.selfState.fields,
            testArgs: [toHex(vaa.encode()), arbiter],
            initialAsset: initAsset,
            inputAssets: [inputAsset, arbiterInputAsset],
            existingContracts: tokenBridgeForChainInfo.states()
        })

        const recipientOutput = testResult.txOutputs[0]
        expect(recipientOutput.address).toEqual(toAddress)
        expect(recipientOutput.alphAmount).toEqual(Number(dustAmount))
        expect(recipientOutput.tokens).toEqual([{
            id: toContractId(tokenWrapperInfo.address),
            amount: transferAmount - arbiterFee
        }])

        const arbiterOutput = testResult.txOutputs[1]
        expect(arbiterOutput.address).toEqual(arbiter)
        expect(arbiterOutput.alphAmount).toEqual(Number(dustAmount))
        expect(arbiterOutput.tokens).toEqual([{
            id: toContractId(tokenWrapperInfo.address),
            amount: Number(arbiterFee)
        }])

        const contractOutput = testResult.txOutputs[2]
        expect(contractOutput.address).toEqual(tokenWrapperInfo.address)
        expect(contractOutput.alphAmount).toEqual(initAsset.alphAmount as bigint - dustAmount)
        expect(contractOutput.tokens).toEqual([{
            id: toContractId(tokenWrapperInfo.address),
            amount: initTokenAmount - transferAmount
        }])
    })
})

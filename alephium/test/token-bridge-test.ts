import { Asset, NodeProvider, ContractEvent, InputAsset, Output, TestContractResult, Token } from 'alephium-web3'
import { nonce, toHex } from '../lib/utils'
import { governanceChainId, governanceContractId, initGuardianSet, messageFee } from './fixtures/governance-fixture'
import { AttestToken, CompleteFailedTransfer, createTestToken, createTokenBridge, createTokenBridgeForChain, createWrapper, RegisterChain, tokenBridgeModule, Transfer } from './fixtures/token-bridge-fixture'
import { CHAIN_ID_ALEPHIUM, ContractUpgrade, createEventEmitter, minimalAlphInContract, encodeU256, expectAssertionFailed, loadContract, oneAlph, randomAssetAddress, toContractId, toRecipientId, u256Max, VAABody, chainIdToBytes, doubleHash, dustAmount } from './fixtures/wormhole-fixture'
import { randomBytes } from 'crypto'
import * as blake from 'blakejs'

describe("test token bridge", () => {
    const provider = new NodeProvider('http://127.0.0.1:22973')

    const payer = randomAssetAddress()
    const inputAsset: InputAsset = {
        address: payer,
        asset: {
            alphAmount: oneAlph * 4n
        }
    }
    const gasPrice = BigInt("100000000000")
    const maxGas = BigInt("625000")
    const gasFee = gasPrice * maxGas

    function checkTxCallerBalance(output: Output, spent: bigint, tokens: Token[] = []) {
        const remain = inputAsset.asset.alphAmount as bigint - gasFee - spent
        expect(output.address).toEqual(payer)
        expect(BigInt(output.alphAmount)).toEqual(remain)
        expect(output.tokens).toEqual(tokens)
    }

    const decimals = 8
    const symbol = toHex(randomBytes(32))
    const name = toHex(randomBytes(32))

    it('should attest token', async () => {
        const eventEmitter = await createEventEmitter(provider)
        const tokenBridgeInfo = await createTokenBridge(provider, eventEmitter)
        const tokenBridge = tokenBridgeInfo.contract
        const testToken = await createTestToken(provider, decimals, symbol, name)
        const nonceHex = nonce()
        const testResult = await tokenBridge.testPublicMethod(provider, 'attestToken', {
            address: tokenBridgeInfo.address,
            initialFields: tokenBridgeInfo.selfState.fields,
            testArgs: {
                'payer': payer,
                'tokenId': testToken.contractId,
                'nonce': nonceHex,
                'consistencyLevel': 0
            },
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeInfo.dependencies.concat(testToken.states())
        })
        const governanceOutput = testResult.txOutputs[0]
        expect(governanceOutput.address).toEqual(tokenBridgeInfo.governance.address)
        expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + messageFee))

        const message = new AttestToken(
            testToken.contractId,
            CHAIN_ID_ALEPHIUM,
            testToken.selfState.fields['symbol_'] as string,
            testToken.selfState.fields['name_'] as string,
            testToken.selfState.fields['decimals_'] as number,
        )
        const events = testResult.events
        expect(events.length).toEqual(1)
        expect(events[0].name).toEqual('WormholeMessage')
        expect(events[0].fields).toEqual({
            'sender': tokenBridgeInfo.contractId,
            'sequence': 0,
            'nonce': nonceHex,
            'payload': toHex(message.encode()),
            'consistencyLevel': 0
        })
    })

    it('should register chain', async () => {
        const eventEmitter = await createEventEmitter(provider)
        const tokenBridgeInfo = await createTokenBridge(provider, eventEmitter)
        const tokenBridge = tokenBridgeInfo.contract
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const registerChain = new RegisterChain(CHAIN_ID_ALEPHIUM, CHAIN_ID_ALEPHIUM + 1, remoteTokenBridgeId)
        const vaaBody = new VAABody(registerChain.encode(), governanceChainId, governanceContractId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const testResult = await tokenBridge.testPublicMethod(provider, 'registerChain', {
            address: tokenBridgeInfo.address,
            initialFields: tokenBridgeInfo.selfState.fields,
            testArgs: {
                'vaa': toHex(vaa.encode()),
                'payer': payer,
                'createContractAlphAmount': minimalAlphInContract
            },
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeInfo.dependencies
        })

        const output = testResult.txOutputs[0]
        const path = Buffer.concat([
            Buffer.from(tokenBridgeInfo.contractId, 'hex'),
            chainIdToBytes(remoteChainId)
        ])
        const expectedContractId = Buffer.from(doubleHash(path)).toString('hex')
        expect(toContractId(output.address)).toEqual(expectedContractId)
        expect(BigInt(output.alphAmount)).toEqual(minimalAlphInContract)
    })

    it('should create token wrapper for local token', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const eventEmitter = await createEventEmitter(provider)
        const tokenBridgeInfo = await createTokenBridge(provider, eventEmitter)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, eventEmitter, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const testToken = await createTestToken(provider, decimals, symbol, name)
        const tokenBridgeForChain = tokenBridgeForChainInfo.contract
        const testResult = await tokenBridgeForChain.testPublicMethod(provider, 'createWrapperForLocalToken', {
            address: tokenBridgeForChainInfo.address,
            initialFields: tokenBridgeForChainInfo.selfState.fields,
            testArgs: {
                'tokenId': testToken.contractId,
                'payer': payer,
                'createContractAlphAmount': minimalAlphInContract
            },
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeForChainInfo.dependencies.concat(testToken.states())
        })

        const tokenWrapperOutput = testResult.txOutputs[0]
        const path = Buffer.concat([
            Buffer.from(tokenBridgeForChainInfo.contractId, 'hex'),
            Buffer.from(testToken.contractId, 'hex')
        ])
        const expectedContractId = Buffer.from(doubleHash(path)).toString('hex')
        expect(toContractId(tokenWrapperOutput.address)).toEqual(expectedContractId)
        expect(BigInt(tokenWrapperOutput.alphAmount)).toEqual(minimalAlphInContract)
        expect(tokenWrapperOutput.tokens).toEqual([])
    })

    it('should transfer local token', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const eventEmitter = await createEventEmitter(provider)
        const tokenBridgeInfo = await createTokenBridge(provider, eventEmitter)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, eventEmitter, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const testTokenInfo = await createTestToken(provider, decimals, symbol, name)
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
        const testResult = await tokenWrapper.testPublicMethod(provider, 'transfer', {
            address: tokenWrapperInfo.address,
            initialFields: tokenWrapperInfo.selfState.fields,
            testArgs: {
                'fromAddress': fromAddress,
                'toAddress': toAddress,
                'amount': transferAmount,
                'arbiterFee': arbiterFee,
                'nonce': nonceHex,
                'consistencyLevel': 0
            },
            inputAssets: [inputAsset],
            existingContracts: tokenWrapperInfo.dependencies.concat(testTokenInfo.states())
        })

        const tokenBridgeForChainOutput = testResult.txOutputs[0]
        expect(tokenBridgeForChainOutput.tokens).toEqual([{
            id: toContractId(testTokenInfo.address),
            amount: transferAmount
        }])
        const governanceOutput = testResult.txOutputs[1]
        expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + messageFee))

        const transferMessage = new Transfer(
            transferAmount,
            toContractId(testTokenInfo.address),
            CHAIN_ID_ALEPHIUM,
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

        expect(event.fields).toEqual({
            'sender': tokenBridgeInfo.contractId,
            'sequence': 0,
            'nonce': nonceHex,
            'payload': toHex(transferMessage.encode()) + toHex(postfix),
            'consistencyLevel': 0
        })
    })

    it('should complete local token transfer', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const eventEmitter = await createEventEmitter(provider)
        const tokenBridgeInfo = await createTokenBridge(provider, eventEmitter)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, eventEmitter, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const testTokenInfo = await createTestToken(provider, decimals, symbol, name)
        const tokenWrapperInfo = await createWrapper(
            testTokenInfo.address, true, decimals, symbol, name, tokenBridgeInfo, tokenBridgeForChainInfo
        )
        const toAddress = randomAssetAddress()
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const transfer = new Transfer(
            transferAmount, toContractId(testTokenInfo.address), CHAIN_ID_ALEPHIUM, toRecipientId(toAddress), CHAIN_ID_ALEPHIUM, arbiterFee
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
        const tokenWrapper = tokenWrapperInfo.contract
        const testResult = await tokenWrapper.testPublicMethod(provider, 'completeTransfer', {
            address: tokenWrapperInfo.address,
            initialFields: tokenWrapperInfo.selfState.fields,
            testArgs: {
                'vaa': toHex(vaa.encode())
            },
            initialAsset: initAsset,
            inputAssets: [inputAsset],
            existingContracts: tokenWrapperInfo.dependencies.concat(testTokenInfo.states())
        })

        const recipientOutput = testResult.txOutputs[0]
        expect(recipientOutput.address).toEqual(toAddress)
        expect(BigInt(recipientOutput.alphAmount)).toEqual(dustAmount)
        expect(recipientOutput.tokens).toEqual([{
            id: toContractId(testTokenInfo.address),
            amount: transferAmount - arbiterFee
        }])

        checkTxCallerBalance(testResult.txOutputs[1], dustAmount, [{
            id: toContractId(testTokenInfo.address),
            amount: Number(arbiterFee)
        }])

        const contractOutput = testResult.txOutputs[2]
        expect(contractOutput.address).toEqual(tokenWrapperInfo.address)
        expect(contractOutput.alphAmount).toEqual(initAsset.alphAmount)
        expect(contractOutput.tokens).toEqual([{
            id: toContractId(testTokenInfo.address),
            amount: initTokenAmount - transferAmount
        }])
    })

    it('should create token wrapper for remote token', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const eventEmitter = await createEventEmitter(provider)
        const tokenBridgeInfo = await createTokenBridge(provider, eventEmitter)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, eventEmitter, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const remoteTokenId = toHex(randomBytes(32))
        const attestToken = new AttestToken(remoteTokenId, remoteChainId, symbol, name, decimals)
        const vaaBody = new VAABody(attestToken.encode(), remoteChainId, remoteTokenBridgeId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const tokenBridgeForChain = tokenBridgeForChainInfo.contract
        const testResult = await tokenBridgeForChain.testPublicMethod(provider, 'createWrapperForRemoteToken', {
            address: tokenBridgeForChainInfo.address,
            initialFields: tokenBridgeForChainInfo.selfState.fields,
            testArgs: {
                'vaa': toHex(vaa.encode()),
                'payer': payer,
                'createContractAlphAmount': minimalAlphInContract
            },
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeForChainInfo.dependencies
        })

        const tokenWrapperOutput = testResult.txOutputs[0]
        const path = Buffer.concat([
            Buffer.from(tokenBridgeForChainInfo.contractId, 'hex'),
            Buffer.from(remoteTokenId, 'hex')
        ])
        const expectedContractId = Buffer.from(doubleHash(path)).toString('hex')
        expect(toContractId(tokenWrapperOutput.address)).toEqual(expectedContractId)
        expect(BigInt(tokenWrapperOutput.alphAmount)).toEqual(minimalAlphInContract)
        const tokenWrapperId = toContractId(tokenWrapperOutput.address)
        expect(tokenWrapperOutput.tokens).toEqual([{
            id: tokenWrapperId,
            amount: u256Max
        }])
    })

    it('should transfer remote token', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const eventEmitter = await createEventEmitter(provider)
        const tokenBridgeInfo = await createTokenBridge(provider, eventEmitter)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, eventEmitter, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
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
        const testResult = await tokenWrapperContract.testPublicMethod(provider, 'transfer', {
            address: tokenWrapperInfo.address,
            initialFields: tokenWrapperInfo.selfState.fields,
            testArgs: {
                'fromAddress': fromAddress,
                'toAddress': toAddress,
                'amount': transferAmount,
                'arbiterFee': arbiterFee,
                'nonce': nonceHex,
                'consistencyLevel': 0 
            },
            inputAssets: [inputAsset],
            existingContracts: tokenWrapperInfo.dependencies
        })

        const tokenWrapperOutput = testResult.txOutputs[0]
        expect(tokenWrapperOutput.tokens).toEqual([{
            id: toContractId(tokenWrapperInfo.address),
            amount: transferAmount
        }])

        const governanceOutput = testResult.txOutputs[1]
        expect(BigInt(governanceOutput.alphAmount)).toEqual(minimalAlphInContract + messageFee)

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

        expect(event.fields).toEqual({
            'sender': toContractId(tokenBridgeInfo.address),
            'sequence': 0,
            'nonce': nonceHex,
            'payload': toHex(transfer.encode()) + toHex(postfix),
            'consistencyLevel': 0
        })
    })

    it('should complete remote token transfer', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const eventEmitter = await createEventEmitter(provider)
        const tokenBridgeInfo = await createTokenBridge(provider, eventEmitter)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, eventEmitter, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
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
            transferAmount, wrappedTokenId, remoteChainId, toRecipientId(toAddress), CHAIN_ID_ALEPHIUM, arbiterFee
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
        const tokenWrapper = tokenWrapperInfo.contract
        const testResult = await tokenWrapper.testPublicMethod(provider, 'completeTransfer', {
            address: tokenWrapperInfo.address,
            initialFields: tokenWrapperInfo.selfState.fields,
            testArgs: {
                'vaa': toHex(vaa.encode())
            },
            initialAsset: initAsset,
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeForChainInfo.states()
        })

        const recipientOutput = testResult.txOutputs[0]
        expect(recipientOutput.address).toEqual(toAddress)
        expect(BigInt(recipientOutput.alphAmount)).toEqual(dustAmount)
        expect(recipientOutput.tokens).toEqual([{
            id: toContractId(tokenWrapperInfo.address),
            amount: transferAmount - arbiterFee
        }])

        checkTxCallerBalance(testResult.txOutputs[1], dustAmount, [{
            id: toContractId(tokenWrapperInfo.address),
            amount: Number(arbiterFee)
        }])

        const contractOutput = testResult.txOutputs[2]
        expect(contractOutput.address).toEqual(tokenWrapperInfo.address)
        expect(contractOutput.alphAmount).toEqual(initAsset.alphAmount)
        expect(contractOutput.tokens).toEqual([{
            id: toContractId(tokenWrapperInfo.address),
            amount: initTokenAmount - transferAmount
        }])
    })

    it('should complete undone sequence transfer', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = toHex(randomBytes(32))
        const eventEmitter = await createEventEmitter(provider)
        const tokenBridgeInfo = await createTokenBridge(provider, eventEmitter)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, eventEmitter, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const wrappedTokenId = toHex(randomBytes(32))
        const tokenWrapperInfo = await createWrapper(
            wrappedTokenId, false, decimals, symbol, name,
            tokenBridgeInfo, tokenBridgeForChainInfo
        )
        const tokenId = toContractId(tokenWrapperInfo.address)
        const toAddress = randomAssetAddress()
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const failedSequence = 10
        const transfer = new CompleteFailedTransfer(
            tokenId, failedSequence, toRecipientId(toAddress), transferAmount, arbiterFee
        )
        const vaaBody = new VAABody(transfer.encode(), governanceChainId, governanceContractId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const initTokenAmount = transferAmount * 2n
        const initAsset: Asset = { alphAmount: oneAlph }
        const tokenBridge = tokenBridgeInfo.contract
        const tokenWrapperState = tokenWrapperInfo.contract.toState(
            tokenWrapperInfo.selfState.fields,
            {alphAmount: oneAlph, tokens: [{id: tokenId, amount: initTokenAmount}]},
            tokenWrapperInfo.address
        )
        const testResult = await tokenBridge.testPublicMethod(provider, 'completeUndoneTransfer', {
            address: tokenBridgeInfo.address,
            initialFields: tokenBridgeInfo.selfState.fields,
            testArgs: {
                'vaa': toHex(vaa.encode())
            },
            initialAsset: initAsset,
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeInfo.dependencies.concat(tokenWrapperState)
        })

        const recipientOutput = testResult.txOutputs[0]
        expect(BigInt(recipientOutput.alphAmount)).toEqual(dustAmount)
        expect(recipientOutput.tokens).toEqual([{
            id: tokenId,
            amount: transferAmount - arbiterFee
        }])

        checkTxCallerBalance(testResult.txOutputs[1], dustAmount, [{
            id: tokenId,
            amount: Number(arbiterFee)
        }])

        const tokenWrapperOutput = testResult.txOutputs[2]
        expect(tokenWrapperOutput.tokens).toEqual([{
            id: tokenId, amount: initTokenAmount - transferAmount
        }])

        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0]
        expect(event.fields).toEqual({
            'sender': toContractId(tokenBridgeInfo.address),
            'remoteChainId': remoteChainId,
            'sequence': failedSequence
        })
        expect(event.contractAddress).toEqual(eventEmitter.address)
    })

    it('should test upgrade contract', async () => {
        const eventEmitter = await createEventEmitter(provider)
        const tokenBridgeInfo = await createTokenBridge(provider, eventEmitter)
        const tokenBridge = tokenBridgeInfo.contract

        async function upgrade(contractUpgrade: ContractUpgrade): Promise<TestContractResult> {
            const vaaBody = new VAABody(contractUpgrade.encode(tokenBridgeModule, 2, CHAIN_ID_ALEPHIUM), governanceChainId, governanceContractId, 0)
            const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
            return tokenBridge.testPublicMethod(provider, 'upgradeContract', {
                address: tokenBridgeInfo.address,
                initialFields: tokenBridgeInfo.selfState.fields,
                testArgs: { 'vaa': toHex(vaa.encode()) },
                initialAsset: {alphAmount: oneAlph},
                existingContracts: tokenBridgeInfo.dependencies,
            })
        }

        {
            const newContractCode = "0e0106010000000000"
            loadContract(newContractCode)
            const contractUpgrade = new ContractUpgrade(newContractCode)
            const testResult = await upgrade(contractUpgrade)
            const newContract = testResult.contracts[testResult.contracts.length-1]
            expect(newContract.address).toEqual(tokenBridgeInfo.address)
            expect(newContract.bytecode).toEqual(newContractCode)
        }

        {
            await expectAssertionFailed(async () => {
                const newContractCode = "000106010000000000"
                const prevStateHash = randomBytes(32).toString('hex')
                const newState = "00"
                const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, newState)
                await upgrade(contractUpgrade)
            })
        }

        {
            const newContractCode = "000106010000000000"
            loadContract(newContractCode)
            const next = tokenBridgeInfo.selfState.fields['next'] as bigint
            const next1 = tokenBridgeInfo.selfState.fields['next1'] as bigint
            const next2 = tokenBridgeInfo.selfState.fields['next2'] as bigint
            const sequence = tokenBridgeInfo.selfState.fields['sequence'] as bigint
            const prevEncodedState = Buffer.concat([
                encodeU256(next), encodeU256(BigInt(next1) + 1n), encodeU256(next2), encodeU256(sequence)
            ])
            const prevStateHash = Buffer.from(blake.blake2b(prevEncodedState, undefined, 32)).toString('hex')
            const newState = "00"
            const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, newState)
            const testResult = await upgrade(contractUpgrade)
            const newContract = testResult.contracts[testResult.contracts.length-1]
            expect(newContract.address).toEqual(tokenBridgeInfo.address)
            expect(newContract.bytecode).toEqual(newContractCode)
            expect(newContract.fields).toEqual({})
        }
    })
})

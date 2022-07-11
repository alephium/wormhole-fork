import { Asset, NodeProvider, InputAsset, Output, TestContractResult, Token, subContractId, ContractState, contractIdFromAddress, binToHex } from '@alephium/web3'
import { nonce, zeroPad } from '../lib/utils'
import { governanceChainId, governanceEmitterAddress, initGuardianSet, messageFee } from './fixtures/governance-fixture'
import { AttestToken, attestTokenHandlerAddress, createAttestTokenHandler, createTestToken, createTokenBridge, createTokenBridgeForChain, createWrapper, DestroyUndoneSequenceContracts, RegisterChain, tokenBridgeForChainAddress, TokenBridgeForChainInfo, TokenBridgeInfo, tokenBridgeModule, Transfer } from './fixtures/token-bridge-fixture'
import { CHAIN_ID_ALEPHIUM, ContractUpgrade, minimalAlphInContract, encodeU256, expectAssertionFailed, loadContract, oneAlph, randomAssetAddress, toRecipientId, u256Max, VAABody, chainIdToBytes, doubleHash, dustAmount, defaultGasFee, randomContractId, randomContractAddress } from './fixtures/wormhole-fixture'
import { randomBytes } from 'crypto'
import * as blake from 'blakejs'
import { createUndoneSequence } from './fixtures/sequence-fixture'

describe("test token bridge", () => {
    const provider = new NodeProvider('http://127.0.0.1:22973')

    const payer = randomAssetAddress()
    const inputAsset: InputAsset = {
        address: payer,
        asset: {
            alphAmount: oneAlph * 4n
        }
    }

    function randomByte32Hex(): string {
        return binToHex(randomBytes(32))
    }

    function checkTxCallerBalance(output: Output, spent: bigint, tokens: Token[] = []) {
        const remain = inputAsset.asset.alphAmount as bigint - defaultGasFee - spent
        expect(output.address).toEqual(payer)
        expect(BigInt(output.alphAmount)).toEqual(remain)
        expect(output.tokens).toEqual(tokens)
    }

    const decimals = 8
    const symbol = binToHex(randomBytes(32))
    const name = binToHex(randomBytes(32))

    it('should attest token', async () => {
        const tokenBridgeInfo = await createTokenBridge(provider)
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
            'targetChainId': 0,
            'sequence': 0,
            'nonce': nonceHex,
            'payload': binToHex(message.encode()),
            'consistencyLevel': 0
        })
    })

    it('should register chain', async () => {
        const tokenBridgeInfo = await createTokenBridge(provider)
        const tokenBridge = tokenBridgeInfo.contract
        const remoteTokenBridgeId = randomByte32Hex()
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const registerChain = new RegisterChain(remoteChainId, remoteTokenBridgeId)
        const vaaBody = new VAABody(registerChain.encode(), governanceChainId, CHAIN_ID_ALEPHIUM, governanceEmitterAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const testResult = await tokenBridge.testPublicMethod(provider, 'registerChain', {
            address: tokenBridgeInfo.address,
            initialFields: tokenBridgeInfo.selfState.fields,
            testArgs: {
                'vaa': binToHex(vaa.encode()),
                'payer': payer,
                'createContractAlphAmount': minimalAlphInContract
            },
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeInfo.dependencies
        })

        const output0 = testResult.txOutputs[0]
        expect(output0.address).toEqual(attestTokenHandlerAddress(tokenBridgeInfo.contractId, remoteChainId))
        expect(output0.alphAmount).toEqual(minimalAlphInContract)
        const output1 = testResult.txOutputs[1]
        expect(output1.address).toEqual(tokenBridgeForChainAddress(tokenBridgeInfo.contractId, remoteChainId))
        expect(output1.alphAmount).toEqual(minimalAlphInContract)
    })

    it('should register chain failed if sequence is invalid', async () => {
        const tokenBridgeInfo = await createTokenBridge(provider)
        const tokenBridge = tokenBridgeInfo.contract
        const registerChain = new RegisterChain(CHAIN_ID_ALEPHIUM + 1, randomContractId())
        const vaaBody = new VAABody(registerChain.encode(), governanceChainId, CHAIN_ID_ALEPHIUM, governanceEmitterAddress, 1)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        await expectAssertionFailed(async () => {
            await tokenBridge.testPublicMethod(provider, 'registerChain', {
                address: tokenBridgeInfo.address,
                initialFields: tokenBridgeInfo.selfState.fields,
                testArgs: {
                    'vaa': binToHex(vaa.encode()),
                    'payer': payer,
                    'createContractAlphAmount': minimalAlphInContract
                },
                inputAssets: [inputAsset],
                existingContracts: tokenBridgeInfo.dependencies
            })
        })
    })

    it('should create token wrapper for local token', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = randomByte32Hex()
        const tokenBridgeInfo = await createTokenBridge(provider)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
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
            Buffer.from(testToken.contractId, 'hex'),
            Buffer.from(tokenBridgeForChainInfo.contractId, 'hex')
        ])
        const expectedContractId = Buffer.from(doubleHash(path)).toString('hex')
        expect(binToHex(contractIdFromAddress(tokenWrapperOutput.address))).toEqual(expectedContractId)
        expect(BigInt(tokenWrapperOutput.alphAmount)).toEqual(minimalAlphInContract)
        expect(tokenWrapperOutput.tokens).toEqual([])
    })

    it('should transfer local token', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = randomByte32Hex()
        const tokenBridgeInfo = await createTokenBridge(provider)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const testTokenInfo = await createTestToken(provider, decimals, symbol, name)
        const tokenWrapperInfo = await createWrapper(
            testTokenInfo.contractId, true, decimals, symbol, name, tokenBridgeInfo, tokenBridgeForChainInfo
        )
        const fromAddress = randomAssetAddress()
        const toAddress = randomByte32Hex()
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const nonceHex = nonce()
        const inputAsset: InputAsset = {
            address: fromAddress,
            asset: {
                alphAmount: oneAlph * 4n,
                tokens: [{
                    id: binToHex(contractIdFromAddress(testTokenInfo.address)),
                    amount: transferAmount * 2n
                }]
            }
        }
        const tokenBridge = tokenBridgeInfo.contract
        const testResult = await tokenBridge.testPublicMethod(provider, 'transferLocalToken', {
            address: tokenBridgeInfo.address,
            initialFields: tokenBridgeInfo.selfState.fields,
            testArgs: {
                'fromAddress': fromAddress,
                'localTokenId': testTokenInfo.contractId,
                'toChainId': remoteChainId,
                'toAddress': toAddress,
                'tokenAmount': transferAmount,
                'arbiterFee': arbiterFee,
                'nonce': nonceHex,
                'consistencyLevel': 0
            },
            inputAssets: [inputAsset],
            existingContracts: tokenWrapperInfo.states().concat(testTokenInfo.states())
        })

        const tokenBridgeForChainState = testResult.contracts.filter(c => c.contractId == tokenBridgeForChainInfo.contractId)
        expect(tokenBridgeForChainState.length).toEqual(1)
        expect(tokenBridgeForChainState[0].fields["sendSequence"]).toEqual(1)

        const tokenWrapperOutput = testResult.txOutputs[0]
        expect(tokenWrapperOutput.tokens).toEqual([{
            id: testTokenInfo.contractId,
            amount: transferAmount
        }])
        const governanceOutput = testResult.txOutputs[1]
        expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + messageFee))

        const transferMessage = new Transfer(
            transferAmount,
            testTokenInfo.contractId,
            CHAIN_ID_ALEPHIUM,
            toAddress,
            arbiterFee
        )
        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0]
        expect(event.name).toEqual('WormholeMessage')
        expect(event.fields).toEqual({
            'sender': tokenBridgeInfo.contractId,
            'targetChainId': remoteChainId,
            'sequence': 0,
            'nonce': nonceHex,
            'payload': binToHex(transferMessage.encode()),
            'consistencyLevel': 0
        })
    })

    it('should complete local token transfer', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = randomByte32Hex()
        const tokenBridgeInfo = await createTokenBridge(provider)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const testTokenInfo = await createTestToken(provider, decimals, symbol, name)
        const tokenWrapperInfo = await createWrapper(
            testTokenInfo.contractId, true, decimals, symbol, name, tokenBridgeInfo, tokenBridgeForChainInfo
        )
        const toAddress = randomAssetAddress()
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const transfer = new Transfer(
            transferAmount, testTokenInfo.contractId, CHAIN_ID_ALEPHIUM, toRecipientId(toAddress), arbiterFee
        )
        const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const initTokenAmount = transferAmount * 2n
        const initAsset: Asset = {
            alphAmount: oneAlph,
            tokens: [{
                id: testTokenInfo.contractId,
                amount: initTokenAmount
            }]
        }
        const tokenWrapper = tokenWrapperInfo.contract

        async function testWithCaller(inputAsset: InputAsset): Promise<TestContractResult> {
            return tokenWrapper.testPublicMethod(provider, 'completeTransfer', {
                address: tokenWrapperInfo.address,
                initialFields: tokenWrapperInfo.selfState.fields,
                testArgs: {
                    'vaa': binToHex(vaa.encode()),
                    'caller': inputAsset.address
                },
                initialAsset: initAsset,
                inputAssets: [inputAsset],
                existingContracts: tokenWrapperInfo.dependencies.concat(testTokenInfo.states())
            })
        }

        const testResult0 = await testWithCaller(inputAsset)
        const recipientOutput0 = testResult0.txOutputs[0]
        expect(recipientOutput0.address).toEqual(toAddress)
        expect(BigInt(recipientOutput0.alphAmount)).toEqual(dustAmount)
        expect(recipientOutput0.tokens).toEqual([{
            id: testTokenInfo.contractId,
            amount: transferAmount - arbiterFee
        }])
        checkTxCallerBalance(testResult0.txOutputs[1], dustAmount, [{
            id: testTokenInfo.contractId,
            amount: Number(arbiterFee)
        }])
        const contractOutput0 = testResult0.txOutputs[2]
        expect(contractOutput0.address).toEqual(tokenWrapperInfo.address)
        expect(contractOutput0.alphAmount).toEqual(initAsset.alphAmount)
        expect(contractOutput0.tokens).toEqual([{
            id: testTokenInfo.contractId,
            amount: initTokenAmount - transferAmount
        }])

        const testResult1 = await testWithCaller({
            address: toAddress,
            asset: {alphAmount: oneAlph}
        })
        const recipientOutput1 = testResult1.txOutputs[0]
        expect(recipientOutput1.address).toEqual(toAddress)
        expect(BigInt(recipientOutput1.alphAmount)).toEqual(oneAlph - defaultGasFee)
        expect(recipientOutput1.tokens).toEqual([{
            id: testTokenInfo.contractId,
            amount: transferAmount
        }])
        const contractOutput1 = testResult1.txOutputs[1]
        expect(contractOutput1.address).toEqual(tokenWrapperInfo.address)
        expect(contractOutput1.alphAmount).toEqual(initAsset.alphAmount)
        expect(contractOutput1.tokens).toEqual([{
            id: testTokenInfo.contractId,
            amount: initTokenAmount - transferAmount
        }])
    })

    it('should create token wrapper for remote token', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = randomByte32Hex()
        const tokenBridgeInfo = await createTokenBridge(provider)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const remoteTokenId = randomByte32Hex()
        const attestToken = new AttestToken(remoteTokenId, remoteChainId, symbol, name, decimals)
        const vaaBody = new VAABody(attestToken.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const attestTokenHandlerInfo = await createAttestTokenHandler(
            provider, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const attestTokenHandler = attestTokenHandlerInfo.contract
        const testResult = await attestTokenHandler.testPublicMethod(provider, 'handleAttestToken', {
            address: attestTokenHandlerInfo.address,
            initialFields: attestTokenHandlerInfo.selfState.fields,
            testArgs: {
                'vaa': binToHex(vaa.encode()),
                'payer': payer,
                'createContractAlphAmount': minimalAlphInContract
            },
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeForChainInfo.states()
        })

        const tokenWrapperOutput = testResult.txOutputs[0]
        const path = Buffer.concat([
            Buffer.from(remoteTokenId, 'hex'),
            Buffer.from(tokenBridgeForChainInfo.contractId, 'hex')
        ])
        const expectedContractId = Buffer.from(doubleHash(path)).toString('hex')
        const tokenWrapperId = binToHex(contractIdFromAddress(tokenWrapperOutput.address))
        expect(tokenWrapperId).toEqual(expectedContractId)
        expect(BigInt(tokenWrapperOutput.alphAmount)).toEqual(minimalAlphInContract)
        expect(tokenWrapperOutput.tokens).toEqual([{
            id: tokenWrapperId,
            amount: u256Max
        }])
    })

    it('should transfer remote token', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = randomByte32Hex()
        const tokenBridgeInfo = await createTokenBridge(provider)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const wrappedTokenId = randomByte32Hex()
        const tokenWrapperInfo = await createWrapper(
            wrappedTokenId, false, decimals, symbol,
            name, tokenBridgeInfo, tokenBridgeForChainInfo
        )
        const fromAddress = randomAssetAddress()
        const toAddress = randomByte32Hex()
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const nonceHex = nonce()
        const inputAsset: InputAsset = {
            address: fromAddress,
            asset: {
                alphAmount: oneAlph,
                tokens: [{
                    id: tokenWrapperInfo.contractId,
                    amount: transferAmount
                }]
            }
        }
        const tokenBridge = tokenBridgeInfo.contract
        const testResult = await tokenBridge.testPublicMethod(provider, 'transferRemoteToken', {
            address: tokenBridgeInfo.address,
            initialFields: tokenBridgeInfo.selfState.fields,
            testArgs: {
                'fromAddress': fromAddress,
                'tokenWrapperId': tokenWrapperInfo.contractId,
                'wrappedTokenId': wrappedTokenId,
                'toChainId': remoteChainId,
                'toAddress': toAddress,
                'tokenAmount': transferAmount,
                'arbiterFee': arbiterFee,
                'nonce': nonceHex,
                'consistencyLevel': 0 
            },
            inputAssets: [inputAsset],
            existingContracts: tokenWrapperInfo.states()
        })

        const tokenBridgeForChainState = testResult.contracts.filter(c => c.contractId == tokenBridgeForChainInfo.contractId)
        expect(tokenBridgeForChainState.length).toEqual(1)
        expect(tokenBridgeForChainState[0].fields["sendSequence"]).toEqual(1)

        const tokenWrapperOutput = testResult.txOutputs[0]
        expect(tokenWrapperOutput.tokens).toEqual([{
            id: tokenWrapperInfo.contractId,
            amount: transferAmount
        }])

        const governanceOutput = testResult.txOutputs[1]
        expect(BigInt(governanceOutput.alphAmount)).toEqual(minimalAlphInContract + messageFee)

        const transfer = new Transfer(
            transferAmount,
            wrappedTokenId,
            remoteChainId,
            toAddress,
            arbiterFee
        )
        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0]
        expect(event.name).toEqual('WormholeMessage')
        expect(event.fields).toEqual({
            'sender': tokenBridgeInfo.contractId,
            'targetChainId': remoteChainId,
            'sequence': 0,
            'nonce': nonceHex,
            'payload': binToHex(transfer.encode()),
            'consistencyLevel': 0
        })
    })

    it('should transfer remote token failed if token wrapper id is invalid', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const tokenBridgeInfo = await createTokenBridge(provider)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, tokenBridgeInfo, remoteChainId, randomContractId()
        )
        const wrappedTokenId = randomByte32Hex()
        const tokenWrapperInfo = await createWrapper(
            wrappedTokenId, false, decimals, symbol, name,
            tokenBridgeInfo, tokenBridgeForChainInfo, randomContractAddress()
        )
        const fromAddress = randomAssetAddress()
        const toAddress = randomByte32Hex()
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const nonceHex = nonce()
        const inputAsset: InputAsset = {
            address: fromAddress,
            asset: {
                alphAmount: oneAlph,
                tokens: [{
                    id: tokenWrapperInfo.contractId,
                    amount: transferAmount
                }]
            }
        }
        const tokenBridge = tokenBridgeInfo.contract
        await expectAssertionFailed(async() => {
            await tokenBridge.testPublicMethod(provider, 'transferRemoteToken', {
                address: tokenBridgeInfo.address,
                initialFields: tokenBridgeInfo.selfState.fields,
                testArgs: {
                    'fromAddress': fromAddress,
                    'tokenWrapperId': tokenWrapperInfo.contractId,
                    'wrappedTokenId': wrappedTokenId,
                    'toChainId': remoteChainId,
                    'toAddress': toAddress,
                    'tokenAmount': transferAmount,
                    'arbiterFee': arbiterFee,
                    'nonce': nonceHex,
                    'consistencyLevel': 0 
                },
                inputAssets: [inputAsset],
                existingContracts: tokenWrapperInfo.states()
            })
        })
    })

    it('should complete remote token transfer', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = randomByte32Hex()
        const tokenBridgeInfo = await createTokenBridge(provider)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const wrappedTokenId = randomByte32Hex()
        const tokenWrapperInfo = await createWrapper(
            wrappedTokenId, false, decimals, symbol,
            name, tokenBridgeInfo, tokenBridgeForChainInfo
        )
        const toAddress = randomAssetAddress()
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const transfer = new Transfer(
            transferAmount, wrappedTokenId, remoteChainId, toRecipientId(toAddress), arbiterFee
        )
        const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const initTokenAmount = transferAmount * 2n
        const initAsset: Asset = {
            alphAmount: oneAlph,
            tokens: [{
                id: tokenWrapperInfo.contractId,
                amount: initTokenAmount
            }]
        }
        const tokenWrapper = tokenWrapperInfo.contract
        const testResult = await tokenWrapper.testPublicMethod(provider, 'completeTransfer', {
            address: tokenWrapperInfo.address,
            initialFields: tokenWrapperInfo.selfState.fields,
            testArgs: {
                'vaa': binToHex(vaa.encode()),
                'caller': payer
            },
            initialAsset: initAsset,
            inputAssets: [inputAsset],
            existingContracts: tokenBridgeForChainInfo.states()
        })

        const recipientOutput = testResult.txOutputs[0]
        expect(recipientOutput.address).toEqual(toAddress)
        expect(BigInt(recipientOutput.alphAmount)).toEqual(dustAmount)
        expect(recipientOutput.tokens).toEqual([{
            id: tokenWrapperInfo.contractId,
            amount: transferAmount - arbiterFee
        }])

        checkTxCallerBalance(testResult.txOutputs[1], dustAmount, [{
            id: tokenWrapperInfo.contractId,
            amount: Number(arbiterFee)
        }])

        const contractOutput = testResult.txOutputs[2]
        expect(contractOutput.address).toEqual(tokenWrapperInfo.address)
        expect(contractOutput.alphAmount).toEqual(initAsset.alphAmount)
        expect(contractOutput.tokens).toEqual([{
            id: tokenWrapperInfo.contractId,
            amount: initTokenAmount - transferAmount
        }])
    })

    it('should failed to complete transfer and create undone sequence contracts', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = randomByte32Hex()
        const tokenBridgeInfo = await createTokenBridge(provider)
        const initAlphAmount = oneAlph * 2n
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId, undefined, initAlphAmount
        )
        const testTokenInfo = await createTestToken(provider, decimals, symbol, name)
        const tokenWrapperInfo = await createWrapper(
            testTokenInfo.contractId, true, decimals, symbol, name, tokenBridgeInfo, tokenBridgeForChainInfo
        )
        const toAddress = randomAssetAddress()
        const transferAmount = oneAlph
        const arbiterFee = messageFee
        const transfer = new Transfer(
            transferAmount, testTokenInfo.contractId, CHAIN_ID_ALEPHIUM, toRecipientId(toAddress), arbiterFee
        )
        const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 768)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const initTokenAmount = transferAmount * 2n
        const initAsset: Asset = {
            alphAmount: oneAlph,
            tokens: [{
                id: testTokenInfo.contractId,
                amount: initTokenAmount
            }]
        }
        const tokenWrapper = tokenWrapperInfo.contract
        const testResult = await tokenWrapper.testPublicMethod(provider, 'completeTransfer', {
            address: tokenWrapperInfo.address,
            initialFields: tokenWrapperInfo.selfState.fields,
            testArgs: {
                'vaa': binToHex(vaa.encode()),
                'caller': payer
            },
            initialAsset: initAsset,
            inputAssets: [inputAsset],
            existingContracts: tokenWrapperInfo.dependencies.concat(testTokenInfo.states())
        })

        const tokenBridgeForChainState = testResult.contracts.filter(c => c.contractId === tokenBridgeForChainInfo.contractId)[0]
        expect(tokenBridgeForChainState.fields['next']).toEqual(256)
        expect(tokenBridgeForChainState.fields['next1']).toEqual(0)
        expect(tokenBridgeForChainState.fields['next2']).toEqual(0)

        // the locked assets have not changed
        const tokenWrapperOutput = testResult.txOutputs.filter(c => c.address === tokenWrapperInfo.address)[0]
        expect(tokenWrapperOutput.alphAmount).toEqual(initAsset.alphAmount)
        expect(tokenWrapperOutput.tokens).toEqual(initAsset.tokens)

        const undoneSequenceContractId = subContractId(tokenBridgeForChainInfo.contractId, '0000000000000000')
        const undoneSequenceState = testResult.contracts.filter(c => c.contractId === undoneSequenceContractId)[0]
        expect(undoneSequenceState.fields['begin']).toEqual(0)
        expect(undoneSequenceState.fields['sequences']).toEqual(0)

        checkTxCallerBalance(testResult.txOutputs[3], 0n)
    })

    it('should destroy undone sequence contracts', async () => {
        const remoteChainId = CHAIN_ID_ALEPHIUM + 1
        const remoteTokenBridgeId = randomByte32Hex()
        const tokenBridgeInfo = await createTokenBridge(provider)
        const tokenBridgeForChainInfo = await createTokenBridgeForChain(
            provider, tokenBridgeInfo, remoteChainId, remoteTokenBridgeId
        )
        const paths = [0, 1, 2, 5, 8]
        const refundAddress = randomAssetAddress()
        const subContracts: ContractState[] = []
        for (let path of paths) {
            const undoneSequenceContractId = subContractId(tokenBridgeForChainInfo.contractId, zeroPad(path.toString(16), 8))
            const contractInfo = await createUndoneSequence(
                provider, tokenBridgeForChainInfo.contractId, path * 256, 0n, refundAddress, undoneSequenceContractId
            )
            subContracts.push(contractInfo.selfState)
        }
        const existingContracts = Array.prototype.concat(tokenBridgeForChainInfo.states(), subContracts) 
        const destroyUndoneSequenceContracts = new DestroyUndoneSequenceContracts(remoteChainId, paths)
        const vaaBody = new VAABody(destroyUndoneSequenceContracts.encode(), governanceChainId, CHAIN_ID_ALEPHIUM, governanceEmitterAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const tokenBridge = tokenBridgeInfo.contract
        const testResult = await tokenBridge.testPublicMethod(provider, 'destroyUndoneSequenceContracts', {
            address: tokenBridgeInfo.address,
            initialFields: tokenBridgeInfo.selfState.fields,
            testArgs: {'vaa': binToHex(vaa.encode())},
            inputAssets: [inputAsset],
            existingContracts: existingContracts
        })

        expect(testResult.events.length).toEqual(paths.length)
        testResult.events.forEach((event, index) => {
            expect(event.name).toEqual('ContractDestroyed')
            expect(event.fields['address']).toEqual(subContracts[index].address)
        })
        const refundAlphAmount = BigInt(paths.length) * oneAlph
        expect(testResult.txOutputs[0].address).toEqual(refundAddress)
        expect(testResult.txOutputs[0].alphAmount).toEqual(refundAlphAmount)
    })

    it('should test upgrade contract', async () => {
        const tokenBridgeInfo = await createTokenBridge(provider)
        const tokenBridge = tokenBridgeInfo.contract

        async function upgrade(contractUpgrade: ContractUpgrade): Promise<TestContractResult> {
            const vaaBody = new VAABody(contractUpgrade.encode(tokenBridgeModule, 2), governanceChainId, CHAIN_ID_ALEPHIUM, governanceEmitterAddress, 0)
            const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
            return tokenBridge.testPublicMethod(provider, 'upgradeContract', {
                address: tokenBridgeInfo.address,
                initialFields: tokenBridgeInfo.selfState.fields,
                testArgs: { 'vaa': binToHex(vaa.encode()) },
                initialAsset: {alphAmount: oneAlph},
                existingContracts: tokenBridgeInfo.dependencies,
            })
        }

        {
            const newContractCode = "090106010000000000"
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
                loadContract(newContractCode)
                const prevStateHash = randomBytes(32).toString('hex')
                const newState = "00"
                const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, newState)
                await upgrade(contractUpgrade)
            })
        }

        {
            const newContractCode = "000106010000000000"
            loadContract(newContractCode)
            const receivedSequence = tokenBridgeInfo.selfState.fields['receivedSequence'] as bigint
            const sendSequence = tokenBridgeInfo.selfState.fields['sendSequence'] as bigint
            const prevEncodedState = Buffer.concat([
                encodeU256(BigInt(receivedSequence) + 1n), encodeU256(sendSequence)
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

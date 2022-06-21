import { Asset, NodeProvider, InputAsset, TestContractResult, Val } from '@alephium/web3'
import { toHex } from '../lib/utils'
import { CHAIN_ID_ALEPHIUM, ContractUpgrade, encodeU256, expectAssertionFailed, expectOneOfError, loadContract, GuardianSet, oneAlph, randomAssetAddress, VAA, VAABody } from './fixtures/wormhole-fixture'
import { randomBytes } from 'crypto'
import * as base58 from 'bs58'
import { createGovernance, governanceChainId, governanceContractId, governanceModule, initGuardianSet, messageFee, SetMessageFee, SubmitTransferFee, UpdateGuardianSet } from './fixtures/governance-fixture'
import * as blake from 'blakejs'

describe("test governance", () => {
    const provider = new NodeProvider("http://127.0.0.1:22973")

    async function testCase(vaa: VAA, method: string, initialAsset?: Asset, inputAssets?: InputAsset[]): Promise<TestContractResult> {
        const governanceInfo = await createGovernance(provider)
        const contract = governanceInfo.contract
        return await contract.testPublicMethod(provider, method, {
            initialFields: governanceInfo.selfState.fields,
            address: governanceInfo.address,
            existingContracts: governanceInfo.dependencies,
            testArgs: { 'vaa': toHex(vaa.encode()) },
            initialAsset: initialAsset,
            inputAssets: inputAssets
        })
    }

    test('should update guardian set', async () => {
        const updateGuardianSet = new UpdateGuardianSet(GuardianSet.random(18, 1))
        const vaaBody = new VAABody(updateGuardianSet.encode(CHAIN_ID_ALEPHIUM), governanceChainId, governanceContractId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const testResult = await testCase(vaa, 'updateGuardianSet')
        const governanceState = testResult.contracts[0]
        expect(governanceState.fields['guardianSets']).toEqual(Array(
            initGuardianSet.guardianSetAddresses(19).map(str => str.toLowerCase()),
            updateGuardianSet.newGuardianSet.guardianSetAddresses(19).map(str => str.toLowerCase())
        ))
        expect(governanceState.fields['guardianSetIndexes']).toEqual(Array(initGuardianSet.index, updateGuardianSet.newGuardianSet.index))
        expect(governanceState.fields['guardianSetSizes']).toEqual(Array(initGuardianSet.size(), updateGuardianSet.newGuardianSet.size()))

        const invalidSequenceVaaBody = new VAABody(updateGuardianSet.encode(CHAIN_ID_ALEPHIUM), governanceChainId, governanceContractId, 1)
        const invalidSequenceVaa = initGuardianSet.sign(initGuardianSet.quorumSize(), invalidSequenceVaaBody)
        await expectAssertionFailed(async () => {
            await testCase(invalidSequenceVaa, 'updateGuardianSet')
        })
    }, 10000)

    it('should failed if signature is not enough', async () => {
        const updateGuardianSet = new UpdateGuardianSet(GuardianSet.random(18, 1))
        const vaaBody = new VAABody(updateGuardianSet.encode(CHAIN_ID_ALEPHIUM), governanceChainId, governanceContractId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize() - 1, vaaBody)
        await expectAssertionFailed(async () => {
            return await testCase(vaa, 'updateGuardianSet')
        })
    })

    it('should failed if signature is duplicated', async () => {
        const updateGuardianSet = new UpdateGuardianSet(GuardianSet.random(18, 1))
        const vaaBody = new VAABody(updateGuardianSet.encode(CHAIN_ID_ALEPHIUM), governanceChainId, governanceContractId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const invalidSignatures = Array(vaa.signatures.length).fill(vaa.signatures[0])
        const invalidVaa = new VAA(vaa.version, vaa.guardianSetIndex, invalidSignatures, vaa.body)
        await expectAssertionFailed(async () => {
            return await testCase(invalidVaa, 'updateGuardianSet')
        })
    })

    it('should failed if signature is invalid', async () => {
        const updateGuardianSet = new UpdateGuardianSet(GuardianSet.random(18, 1))
        const vaaBody = new VAABody(updateGuardianSet.encode(CHAIN_ID_ALEPHIUM), governanceChainId, governanceContractId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const invalidSignatures = Array(vaa.signatures.length).fill(0).map(_ => randomBytes(66))
        const invalidVaa = new VAA(vaa.version, vaa.guardianSetIndex, invalidSignatures, vaa.body)
        await expectOneOfError(
            async () => await testCase(invalidVaa, 'updateGuardianSet'),
            ["AssertionFailed", "FailedInRecoverEthAddress", "InvalidConversion"]
        )
    })

    it('should set message fee', async () => {
        const setMessageFee = new SetMessageFee(messageFee * 2n)
        const vaaBody = new VAABody(setMessageFee.encode(CHAIN_ID_ALEPHIUM), governanceChainId, governanceContractId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const testResult = await testCase(vaa, 'setMessageFee')
        const governanceState = testResult.contracts[0]
        expect(governanceState.fields['messageFee']).toEqual(Number(setMessageFee.newMessageFee))
    })

    it('should transfer message fee to recipient', async () => {
        const asset: Asset = {
            alphAmount: oneAlph * 4n
        }
        const inputAsset: InputAsset = {
            address: randomAssetAddress(),
            asset: {
                alphAmount: oneAlph * 4n
            }
        }
        const recipient = randomBytes(32)
        const amount = messageFee * 20n
        const submitTransferFee = new SubmitTransferFee(toHex(recipient), amount)
        const vaaBody = new VAABody(submitTransferFee.encode(CHAIN_ID_ALEPHIUM), governanceChainId, governanceContractId, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const testResult = await testCase(vaa, 'submitTransferFee', asset, [inputAsset])
        const assetOutput = testResult.txOutputs[0]
        expect(assetOutput.type).toEqual("AssetOutput")
        expect(assetOutput.address).toEqual(base58.encode(Buffer.concat([Buffer.from([0x00]), recipient])))
        expect(BigInt(assetOutput.alphAmount)).toEqual(amount)

        const contractOutput = testResult.txOutputs[1]
        const governanceState = testResult.contracts[0]
        expect(contractOutput.type).toEqual("ContractOutput")
        expect(contractOutput.address).toEqual(governanceState.address)
        expect(contractOutput.alphAmount).toEqual(BigInt(asset.alphAmount) - amount)
    })

    it('should test upgrade contract', async () => {
        const governanceInfo = await createGovernance(provider)
        const contract = governanceInfo.contract
        async function upgrade(contractUpgrade: ContractUpgrade): Promise<TestContractResult> {
            const vaaBody = new VAABody(contractUpgrade.encode(governanceModule, 1, CHAIN_ID_ALEPHIUM), governanceChainId, governanceContractId, 0)
            const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
            return await contract.testPublicMethod(provider, 'upgradeContract', {
                initialFields: governanceInfo.selfState.fields,
                address: governanceInfo.address,
                existingContracts: governanceInfo.dependencies,
                testArgs: { 'vaa': toHex(vaa.encode()) },
            })
        }

        {
            const newContractCode = "40300106010000000000"
            loadContract(newContractCode)
            const contractUpgrade = new ContractUpgrade(newContractCode)
            const testResult = await upgrade(contractUpgrade)
            const newContract = testResult.contracts[testResult.contracts.length-1]
            expect(newContract.address).toEqual(governanceInfo.address)
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
            const receivedSequence = governanceInfo.selfState.fields['receivedSequence'] as bigint
            const messageFee = governanceInfo.selfState.fields['messageFee'] as bigint
            const guardianSetIndexes = governanceInfo.selfState.fields['guardianSetIndexes'] as Val[]
            const guardianSetIndex0 = guardianSetIndexes[0] as bigint
            const guardianSetIndex1 = guardianSetIndexes[1] as bigint
            const prevEncodedState = Buffer.concat([
                encodeU256(BigInt(receivedSequence) + 1n), encodeU256(messageFee),
                encodeU256(guardianSetIndex0), encodeU256(guardianSetIndex1)
            ])
            const prevStateHash = Buffer.from(blake.blake2b(prevEncodedState, undefined, 32)).toString('hex')
            const newContractCode = "000106010000000000"
            loadContract(newContractCode)
            const newState = "00"
            const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, newState)
            const testResult = await upgrade(contractUpgrade)
            const newContract = testResult.contracts[testResult.contracts.length-1]
            expect(newContract.address).toEqual(governanceInfo.address)
            expect(newContract.bytecode).toEqual(newContractCode)
            expect(newContract.fields).toEqual({})
        }
    })
})

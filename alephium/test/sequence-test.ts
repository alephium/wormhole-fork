import { addressFromContractId, NodeProvider, Project, subContractId } from '@alephium/web3'
import { createSequence, createUndoneSequence } from './fixtures/sequence-fixture'
import { defaultGasFee, expectAssertionFailed, oneAlph, randomAssetAddress, randomContractId } from './fixtures/wormhole-fixture'

describe("test sequence", () => {
    const provider = new NodeProvider('http://127.0.0.1:22973')
    Project.setNodeProvider(provider)
    const allExecuted = (BigInt(1) << BigInt(256)) - 1n
    const refundAddress = randomAssetAddress()

    it("should execute correctly", async () => {
        const sequenceInfo = await createSequence(0, 0n, 0n, refundAddress)
        const sequence = sequenceInfo.contract
        for (let seq = 0; seq < 256; seq++) {
            const testResult = await sequence.testPrivateMethod(provider, 'checkSequence', {
                initialFields: sequenceInfo.selfState.fields,
                address: sequenceInfo.address,
                testArgs: { 'seq': seq },
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            })
            expect(testResult.returns).toEqual([true])
            expect(testResult.contracts.length).toEqual(1)
            expect(testResult.contracts[0].fields['next']).toEqual(0)
            const next1 = BigInt(1) << BigInt(seq)
            expect(testResult.contracts[0].fields['next1'].toString()).toEqual(next1.toString())
            expect(testResult.contracts[0].fields['next2']).toEqual(0)
            expect(testResult.events.length).toEqual(0)
        }

        for (let seq = 256; seq < 512; seq++) {
            const testResult = await sequence.testPrivateMethod(provider, 'checkSequence', {
                initialFields: sequenceInfo.selfState.fields,
                address: sequenceInfo.address,
                testArgs: { 'seq': seq },
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            })
            expect(testResult.returns).toEqual([true])
            expect(testResult.contracts.length).toEqual(1)
            expect(testResult.contracts[0].fields['next']).toEqual(0)
            expect(testResult.contracts[0].fields['next1']).toEqual(0)
            const next2 = BigInt(1) << BigInt(seq - 256)
            expect(testResult.contracts[0].fields['next2'].toString()).toEqual(next2.toString())
            expect(testResult.events.length).toEqual(0)
        }
    }, 90000)

    it("should increase executed sequence", async () => {
        const sequenceInfo = await createSequence(512, allExecuted, allExecuted, refundAddress)
        const sequence = sequenceInfo.contract
        const testResult = await sequence.testPrivateMethod(provider, 'checkSequence', {
            initialFields: sequenceInfo.selfState.fields,
            address: sequenceInfo.address,
            testArgs: { 'seq': 1025 },
            inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
        })
        expect(testResult.returns).toEqual([true])
        expect(testResult.contracts.length).toEqual(1)
        expect(testResult.contracts[0].fields['next']).toEqual(512 + 256)
        expect(testResult.contracts[0].fields['next1']).toEqual(allExecuted)
        expect(testResult.contracts[0].fields['next2']).toEqual(2)
        expect(testResult.events.length).toEqual(0)
    })

    it('should check sequence failed and create undone sequence subcontract', async () => {
        const sequenceInfo = await createSequence(0, 1n, 1n, refundAddress)
        const sequence = sequenceInfo.contract
        const testResult = await sequence.testPrivateMethod(provider, 'checkSequence', {
            initialFields: sequenceInfo.selfState.fields,
            initialAsset: {alphAmount: oneAlph * 2n},
            address: sequenceInfo.address,
            testArgs: { 'seq': 768 },
            inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}],
            existingContracts: sequenceInfo.dependencies
        })
        expect(testResult.returns).toEqual([false])
        const sequenceContractState = testResult.contracts[2]
        expect(sequenceContractState.fields['next']).toEqual(256)
        expect(sequenceContractState.fields['next1']).toEqual(1)
        expect(sequenceContractState.fields['next2']).toEqual(0)

        const undoneSequenceContractState = testResult.contracts[0]
        expect(undoneSequenceContractState.fields['begin']).toEqual(0)
        expect(undoneSequenceContractState.fields['sequences']).toEqual(1)

        const sequenceOutput = testResult.txOutputs[1]
        expect(sequenceOutput.alphAmount).toEqual(oneAlph)
        const undoneSequenceOutput = testResult.txOutputs[0]
        expect(undoneSequenceOutput.address).toEqual(
            addressFromContractId(subContractId(sequenceInfo.contractId, '0000000000000000'))
        )
    })

    it("should failed when executed repeatedly", async () => {
        const undoneSequenceTemplateId = randomContractId()
        const sequenceInfo = await createSequence(0, allExecuted, 0n, refundAddress)
        const sequence = sequenceInfo.contract
        for (let seq = 0; seq < 256; seq++) {
            await expectAssertionFailed(async() => {
                return await sequence.testPrivateMethod(provider, "checkSequence", {
                    initialFields: sequenceInfo.selfState.fields,
                    address: sequenceInfo.address,
                    testArgs: { 'seq': seq },
                    existingContracts: sequenceInfo.dependencies,
                    inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
                })
            })
        }

        for (let seq = 256; seq < 512; seq++) {
            await expectAssertionFailed(async() => {
                return await sequence.testPrivateMethod(provider, "checkSequence", {
                    initialFields: {
                        'next': 0,
                        'next1': 0,
                        'next2': allExecuted,
                        'undoneSequenceId': '',
                        'undoneSequenceTemplateId': undoneSequenceTemplateId,
                        'refundAddress': refundAddress
                    },
                    address: sequenceInfo.address,
                    testArgs: { 'seq': seq },
                    existingContracts: sequenceInfo.dependencies,
                    inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
                })
            })
        }
    }, 120000)

    it('should check sequence succeed and create undone sequence subcontract', async () => {
        const next = 256
        const next1 = (BigInt(0xff) << 248n)
        const sequenceInfo = await createSequence(next, next1, 0n, refundAddress)
        const sequence = sequenceInfo.contract
        const testResult = await sequence.testPrivateMethod(provider, 'checkSequence', {
            initialFields: sequenceInfo.selfState.fields,
            initialAsset: {alphAmount: oneAlph * 10n},
            address: sequenceInfo.address,
            testArgs: { 'seq': next + 513 },
            existingContracts: sequenceInfo.dependencies,
            inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
        })
        expect(testResult.returns).toEqual([true])
        const subContractOutput = testResult.contracts[0]
        expect(subContractOutput.fields['begin']).toEqual(256)
        expect(subContractOutput.fields['sequences']).toEqual(next1)
        const expectedContractId = subContractId(sequenceInfo.contractId, '0000000000000001')
        expect(subContractOutput.contractId).toEqual(expectedContractId)
        expect(testResult.contracts[2].fields['next']).toEqual(next + 256)
        expect(testResult.contracts[2].fields['next1']).toEqual(0)
        expect(testResult.contracts[2].fields['next2']).toEqual(2)
        expect(testResult.events.length).toEqual(1)
    })

    it('should mark old sequence as done', async () => {
        const parentId = randomContractId()
        const sequenceInfo = await createSequence(512, 0n, 0n, refundAddress, parentId)
        const undoneSequenceContractId = subContractId(parentId, '0000000000000001')
        const sequences = allExecuted - 0xffn
        const undoneSequenceInfo = await createUndoneSequence(
            parentId, 256, sequences, refundAddress, undoneSequenceContractId
        )
        const sequence = sequenceInfo.contract
        for (let seq = 0; seq < 8; seq++) {
            const testResult = await sequence.testPrivateMethod(provider, 'checkSequence', {
                initialFields: sequenceInfo.selfState.fields,
                initialAsset: {alphAmount: oneAlph * 10n},
                address: sequenceInfo.address,
                testArgs: { 'seq': 256 + seq },
                existingContracts: Array.prototype.concat(sequenceInfo.dependencies, undoneSequenceInfo.states()),
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            })
            expect(testResult.returns).toEqual([true])
            const undoneSequenceContract = testResult.contracts[1]
            expect(undoneSequenceContract.fields['sequences']).toEqual(sequences + (1n << BigInt(seq)))
            expect(testResult.contracts[2].fields['next']).toEqual(512)
            expect(testResult.contracts[2].fields['next1']).toEqual(0)
            expect(testResult.contracts[2].fields['next2']).toEqual(0)
            expect(testResult.events.length).toEqual(0)
        }
    })

    it('should failed if old sequences executed', async () => {
        const parentId = randomContractId()
        const sequenceInfo = await createSequence(512, 0n, 0n, refundAddress, parentId)
        const undoneSequenceContractId = subContractId(parentId, '0000000000000001')
        const sequences = allExecuted - 1n
        const undoneSequenceInfo = await createUndoneSequence(
            parentId, 256, sequences, refundAddress, undoneSequenceContractId
        )
        const sequence = sequenceInfo.contract
        for (let seq = 1; seq < 256; seq++) {
            await expectAssertionFailed(async () => {
                await sequence.testPrivateMethod(provider, 'checkSequence', {
                    initialFields: sequenceInfo.selfState.fields,
                    initialAsset: {alphAmount: oneAlph * 10n},
                    address: sequenceInfo.address,
                    testArgs: { 'seq': 256 + seq },
                    existingContracts: Array.prototype.concat(sequenceInfo.dependencies, undoneSequenceInfo.states()),
                    inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
                })
            })
        }
    }, 60000)

    it('should destroy sub contract if all old sequence executed', async () => {
        const parentId = randomContractId()
        const sequenceInfo = await createSequence(512, 0n, 0n, refundAddress, parentId)
        const undoneSequenceContractId = subContractId(parentId, '0000000000000001')
        const sequences = allExecuted - 1n
        const undoneSequenceInfo = await createUndoneSequence(
            parentId, 256, sequences, refundAddress, undoneSequenceContractId
        )
        const sequence = sequenceInfo.contract
        const testResult = await sequence.testPrivateMethod(provider, 'checkSequence', {
            initialFields: sequenceInfo.selfState.fields,
            initialAsset: {alphAmount: oneAlph * 10n},
            address: sequenceInfo.address,
            testArgs: { 'seq': 256 },
            existingContracts: Array.prototype.concat(sequenceInfo.dependencies, undoneSequenceInfo.states()),
            inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
        })
        expect(testResult.returns).toEqual([true])
        expect(testResult.contracts.map(c => c.address).includes(undoneSequenceInfo.address)).toEqual(false)
        expect(testResult.events.length).toEqual(1)
        const destroyEvent = testResult.events[0]
        expect(destroyEvent.name).toEqual('ContractDestroyed')
        expect(destroyEvent.fields['address']).toEqual(undoneSequenceInfo.address)
        const assetOutput = testResult.txOutputs[0]
        expect(assetOutput.alphAmount).toEqual(oneAlph * 2n - defaultGasFee)
    })
})

import { addressFromContractId, InputAsset, NodeProvider, subContractId } from '@alephium/web3'
import { createSequence, createUnexecutedSequence } from './fixtures/sequence-fixture'
import { buildProject, defaultGasFee, expectAssertionFailed, oneAlph, randomAssetAddress, randomContractId } from './fixtures/wormhole-fixture'

describe("test sequence", () => {
    const provider = new NodeProvider('http://127.0.0.1:22973')
    const allExecuted = (BigInt(1) << BigInt(256)) - 1n
    const refundAddress = randomAssetAddress()
    const inputAsset: InputAsset[] = [{
        address: refundAddress,
        asset: {alphAmount: oneAlph}
    }]

    it("should execute correctly", async () => {
        await buildProject(provider)
        const sequenceInfo = createSequence(0, 0n, 0n, refundAddress)
        const sequence = sequenceInfo.contract
        for (let seq = 0; seq < 256; seq++) {
            const testResult = await sequence.testPrivateMethod('checkSequence', {
                initialFields: sequenceInfo.selfState.fields,
                address: sequenceInfo.address,
                testArgs: { 'seq': seq },
                inputAssets: inputAsset
            })
            expect(testResult.returns).toEqual([true])
            expect(testResult.contracts.length).toEqual(1)
            expect(testResult.contracts[0].fields['start']).toEqual(0)
            const firstNext256 = BigInt(1) << BigInt(seq)
            expect(testResult.contracts[0].fields['firstNext256'].toString()).toEqual(firstNext256.toString())
            expect(testResult.contracts[0].fields['secondNext256']).toEqual(0)
            expect(testResult.events.length).toEqual(0)
        }

        for (let seq = 256; seq < 512; seq++) {
            const testResult = await sequence.testPrivateMethod('checkSequence', {
                initialFields: sequenceInfo.selfState.fields,
                address: sequenceInfo.address,
                testArgs: { 'seq': seq },
                inputAssets: inputAsset
            })
            expect(testResult.returns).toEqual([true])
            expect(testResult.contracts.length).toEqual(1)
            expect(testResult.contracts[0].fields['start']).toEqual(0)
            expect(testResult.contracts[0].fields['firstNext256']).toEqual(0)
            const secondNext256 = BigInt(1) << BigInt(seq - 256)
            expect(testResult.contracts[0].fields['secondNext256'].toString()).toEqual(secondNext256.toString())
            expect(testResult.events.length).toEqual(0)
        }
    }, 90000)

    it("should increase executed sequence", async () => {
        await buildProject(provider)
        const sequenceInfo = createSequence(512, allExecuted, allExecuted, refundAddress)
        const sequence = sequenceInfo.contract
        const testResult = await sequence.testPrivateMethod('checkSequence', {
            initialFields: sequenceInfo.selfState.fields,
            address: sequenceInfo.address,
            testArgs: { 'seq': 1025 },
            inputAssets: inputAsset
        })
        expect(testResult.returns).toEqual([true])
        expect(testResult.contracts.length).toEqual(1)
        expect(testResult.contracts[0].fields['start']).toEqual(512 + 256)
        expect(testResult.contracts[0].fields['firstNext256']).toEqual(allExecuted)
        expect(testResult.contracts[0].fields['secondNext256']).toEqual(2)
        expect(testResult.events.length).toEqual(0)
    })

    it('should check sequence failed and create unexecuted sequence subcontract', async () => {
        await buildProject(provider)
        const sequenceInfo = createSequence(0, 1n, 1n, refundAddress)
        const sequence = sequenceInfo.contract
        const testResult = await sequence.testPrivateMethod('checkSequence', {
            initialFields: sequenceInfo.selfState.fields,
            initialAsset: {alphAmount: oneAlph * 2n},
            address: sequenceInfo.address,
            testArgs: { 'seq': 768 },
            inputAssets: inputAsset,
            existingContracts: sequenceInfo.dependencies
        })
        expect(testResult.returns).toEqual([false])
        const sequenceContractState = testResult.contracts[2]
        expect(sequenceContractState.fields['start']).toEqual(256)
        expect(sequenceContractState.fields['firstNext256']).toEqual(1)
        expect(sequenceContractState.fields['secondNext256']).toEqual(0)

        const unexecutedSequenceContractState = testResult.contracts[0]
        expect(unexecutedSequenceContractState.fields['begin']).toEqual(0)
        expect(unexecutedSequenceContractState.fields['sequences']).toEqual(1)

        const sequenceOutput = testResult.txOutputs[1]
        expect(sequenceOutput.alphAmount).toEqual(oneAlph)
        const unexecutedSequenceOutput = testResult.txOutputs[0]
        expect(unexecutedSequenceOutput.address).toEqual(
            addressFromContractId(subContractId(sequenceInfo.contractId, '0000000000000000'))
        )
    })

    it("should failed when executed repeatedly", async () => {
        await buildProject(provider)
        const unexecutedSequenceTemplateId = randomContractId()
        const sequenceInfo = createSequence(0, allExecuted, 0n, refundAddress)
        const sequence = sequenceInfo.contract
        for (let seq = 0; seq < 256; seq++) {
            await expectAssertionFailed(async() => {
                return await sequence.testPrivateMethod("checkSequence", {
                    initialFields: sequenceInfo.selfState.fields,
                    address: sequenceInfo.address,
                    testArgs: { 'seq': seq },
                    existingContracts: sequenceInfo.dependencies,
                    inputAssets: inputAsset
                })
            })
        }

        for (let seq = 256; seq < 512; seq++) {
            await expectAssertionFailed(async() => {
                return await sequence.testPrivateMethod("checkSequence", {
                    initialFields: {
                        'start': 0,
                        'firstNext256': 0,
                        'secondNext256': allExecuted,
                        'unexecutedSequenceTemplateId': unexecutedSequenceTemplateId,
                        'refundAddress': refundAddress
                    },
                    address: sequenceInfo.address,
                    testArgs: { 'seq': seq },
                    existingContracts: sequenceInfo.dependencies,
                    inputAssets: inputAsset
                })
            })
        }
    }, 120000)

    it('should check sequence succeed and create unexecuted sequence subcontract', async () => {
        await buildProject(provider)
        const start = 256
        const firstNext256 = (BigInt(0xff) << 248n)
        const sequenceInfo = createSequence(start, firstNext256, 0n, refundAddress)
        const sequence = sequenceInfo.contract
        const testResult = await sequence.testPrivateMethod('checkSequence', {
            initialFields: sequenceInfo.selfState.fields,
            initialAsset: {alphAmount: oneAlph * 2n},
            address: sequenceInfo.address,
            testArgs: { 'seq': start + 513 },
            existingContracts: sequenceInfo.dependencies,
            inputAssets: inputAsset
        })
        expect(testResult.returns).toEqual([true])
        const sequenceContractState = testResult.contracts[2]
        expect(sequenceContractState.fields['start']).toEqual(start + 256)
        expect(sequenceContractState.fields['firstNext256']).toEqual(0)
        expect(sequenceContractState.fields['secondNext256']).toEqual(2)
        expect(sequenceContractState.asset).toEqual({alphAmount: oneAlph, tokens: []})

        const subContractOutput = testResult.contracts[0]
        expect(subContractOutput.fields['begin']).toEqual(256)
        expect(subContractOutput.fields['sequences']).toEqual(firstNext256)
        const expectedContractId = subContractId(sequenceInfo.contractId, '0000000000000001')
        expect(subContractOutput.contractId).toEqual(expectedContractId)
        expect(testResult.events.length).toEqual(1)
    })

    it('should mark old sequence as done', async () => {
        await buildProject(provider)
        const parentId = randomContractId()
        const sequenceInfo = createSequence(512, 0n, 0n, refundAddress, parentId)
        const unexecutedSequenceContractId = subContractId(parentId, '0000000000000001')
        const sequences = allExecuted - 0xffn
        const unexecutedSequenceInfo = createUnexecutedSequence(
            parentId, 256, sequences, unexecutedSequenceContractId
        )
        const sequence = sequenceInfo.contract
        for (let seq = 0; seq < 8; seq++) {
            const testResult = await sequence.testPrivateMethod('checkSequence', {
                initialFields: sequenceInfo.selfState.fields,
                initialAsset: {alphAmount: oneAlph * 10n},
                address: sequenceInfo.address,
                testArgs: { 'seq': 256 + seq },
                existingContracts: Array.prototype.concat(sequenceInfo.dependencies, unexecutedSequenceInfo.states()),
                inputAssets: inputAsset
            })
            expect(testResult.returns).toEqual([true])
            const unexecutedSequenceContract = testResult.contracts[1]
            expect(unexecutedSequenceContract.fields['sequences']).toEqual(sequences + (1n << BigInt(seq)))
            expect(testResult.contracts[2].fields['start']).toEqual(512)
            expect(testResult.contracts[2].fields['firstNext256']).toEqual(0)
            expect(testResult.contracts[2].fields['secondNext256']).toEqual(0)
            expect(testResult.events.length).toEqual(0)
        }
    })

    it('should failed if old sequences executed', async () => {
        await buildProject(provider)
        const parentId = randomContractId()
        const sequenceInfo = createSequence(512, 0n, 0n, refundAddress, parentId)
        const unexecutedSequenceContractId = subContractId(parentId, '0000000000000001')
        const sequences = allExecuted - 1n
        const unexecutedSequenceInfo = createUnexecutedSequence(
            parentId, 256, sequences, unexecutedSequenceContractId
        )
        const sequence = sequenceInfo.contract
        for (let seq = 1; seq < 256; seq++) {
            await expectAssertionFailed(async () => {
                await sequence.testPrivateMethod('checkSequence', {
                    initialFields: sequenceInfo.selfState.fields,
                    initialAsset: {alphAmount: oneAlph * 10n},
                    address: sequenceInfo.address,
                    testArgs: { 'seq': 256 + seq },
                    existingContracts: Array.prototype.concat(sequenceInfo.dependencies, unexecutedSequenceInfo.states()),
                    inputAssets: inputAsset
                })
            })
        }
    }, 60000)

    it('should destroy sub contract if all old sequence executed', async () => {
        await buildProject(provider)
        const parentId = randomContractId()
        const sequenceInfo = createSequence(512, 0n, 0n, refundAddress, parentId)
        const unexecutedSequenceContractId = subContractId(parentId, '0000000000000001')
        const sequences = allExecuted - 1n
        const unexecutedSequenceInfo = createUnexecutedSequence(
            parentId, 256, sequences, unexecutedSequenceContractId
        )
        const sequence = sequenceInfo.contract
        const testResult = await sequence.testPrivateMethod('checkSequence', {
            initialFields: sequenceInfo.selfState.fields,
            initialAsset: {alphAmount: oneAlph},
            address: sequenceInfo.address,
            testArgs: { 'seq': 256 },
            existingContracts: Array.prototype.concat(sequenceInfo.dependencies, unexecutedSequenceInfo.states()),
            inputAssets: inputAsset
        })
        const sequenceContractAsset = testResult.contracts[1].asset
        expect(sequenceContractAsset).toEqual({alphAmount: 2n * oneAlph, tokens: []})

        expect(testResult.returns).toEqual([true])
        expect(testResult.contracts.map(c => c.address).includes(unexecutedSequenceInfo.address)).toEqual(false)
        expect(testResult.events.length).toEqual(1)
        const destroyEvent = testResult.events[0]
        expect(destroyEvent.name).toEqual('ContractDestroyed')
        expect(destroyEvent.fields['address']).toEqual(unexecutedSequenceInfo.address)
        const assetOutput = testResult.txOutputs[1]
        expect(assetOutput.alphAmount).toEqual(oneAlph - defaultGasFee)
    })
})

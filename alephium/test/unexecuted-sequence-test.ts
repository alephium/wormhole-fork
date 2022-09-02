import { NodeProvider, Number256, addressFromContractId, Project } from '@alephium/web3'
import { createUnexecutedSequence } from './fixtures/sequence-fixture'
import { buildProject, expectAssertionFailed, oneAlph, randomAssetAddress, randomContractId } from './fixtures/wormhole-fixture'

describe("test unexecuted sequence", () => {
    const provider = new NodeProvider('http://127.0.0.1:22973')
    const allExecuted = (BigInt(1) << BigInt(256)) - 1n

    it('should check sequence passed', async () => {
        await buildProject(provider)
        const parentId = randomContractId()
        const refundAddress = randomAssetAddress()
        const startSequence = 256
        const unexecutedSequenceTest = Project.contract('tests/unexecuted_sequence_test.ral')
        let sequences = 0n
        for (let seq = 0; seq < 255; seq++) {
            const unexecutedSequenceInfo = createUnexecutedSequence(parentId, startSequence, sequences, refundAddress)
            const testResult = await unexecutedSequenceTest.testPublicMethod('checkSequence', {
                initialFields: { 'unexecutedSequenceId': unexecutedSequenceInfo.contractId },
                address: addressFromContractId(parentId),
                testArgs: { 'seq': seq + startSequence },
                existingContracts: unexecutedSequenceInfo.states(),
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            })
            sequences = sequences + (1n << BigInt(seq))
            const unexecutedSequence = testResult.contracts[0]
            expect(BigInt(unexecutedSequence.fields['sequences'] as Number256)).toEqual(sequences)
        }
    }, 50000)

    it('should check sequence failed if sequence executed', async () => {
        await buildProject(provider)
        const parentId = randomContractId()
        const refundAddress = randomAssetAddress()
        const startSequence = 256
        const unexecutedSequenceTest = Project.contract('tests/unexecuted_sequence_test.ral')
        for (let seq = 0; seq < 256; seq++) {
            const sequences = 1n << BigInt(seq)
            const unexecutedSequenceInfo = createUnexecutedSequence(parentId, startSequence, sequences, refundAddress)
            await expectAssertionFailed(async () => await unexecutedSequenceTest.testPublicMethod('checkSequence', {
                initialFields: { 'unexecutedSequenceId': unexecutedSequenceInfo.contractId },
                address: addressFromContractId(parentId),
                testArgs: { 'seq': seq + startSequence },
                existingContracts: unexecutedSequenceInfo.states(),
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            }))
        }
    }, 60000)

    it('should check sequence failed if sequence is out of range', async () => {
        await buildProject(provider)
        const parentId = randomContractId()
        const refundAddress = randomAssetAddress()
        const startSequence = 256
        const sequences = [0, startSequence - 1, startSequence * 2, startSequence * 10]
        const unexecutedSequenceInfo = createUnexecutedSequence(parentId, startSequence, 0n, refundAddress)
        const unexecutedSequenceTest = Project.contract('tests/unexecuted_sequence_test.ral')
        for (let seq of sequences) {
            await expectAssertionFailed(async () => await unexecutedSequenceTest.testPublicMethod('checkSequence', {
                initialFields: { 'unexecutedSequenceId': unexecutedSequenceInfo.contractId },
                address: addressFromContractId(parentId),
                testArgs: { 'seq': seq },
                existingContracts: unexecutedSequenceInfo.states(),
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            }))
        }
    })

    it('should destroy contract if all sequences executed', async () => {
        await buildProject(provider)
        const parentId = randomContractId()
        const refundAddress = randomAssetAddress()
        const startSequence = 0
        const unexecutedSequenceOffset = 1
        const sequences = allExecuted - (1n << BigInt(unexecutedSequenceOffset))
        const unexecutedSequenceInfo = createUnexecutedSequence(parentId, startSequence, sequences, refundAddress)
        const unexecutedSequenceTest = Project.contract('tests/unexecuted_sequence_test.ral')
        const testResult = await unexecutedSequenceTest.testPublicMethod('checkSequence', {
            initialFields: { 'unexecutedSequenceId': unexecutedSequenceInfo.contractId },
            address: addressFromContractId(parentId),
            testArgs: { 'seq': startSequence + unexecutedSequenceOffset },
            existingContracts: unexecutedSequenceInfo.states(),
            inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
        })

        expect(testResult.contracts.length).toEqual(1)
        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0]
        expect(event.name).toEqual('ContractDestroyed')
        expect(event.fields['address']).toEqual(unexecutedSequenceInfo.address)
    })

    it('should destroy contract manually', async () => {
        await buildProject(provider)
        const parentId = randomContractId()
        const refundAddress = randomAssetAddress()
        const unexecutedSequenceInfo = createUnexecutedSequence(parentId, 0, 0n, refundAddress)
        const unexecutedSequenceTest = Project.contract('tests/unexecuted_sequence_test.ral')
        const testResult = await unexecutedSequenceTest.testPublicMethod('destroy', {
            initialFields: { 'unexecutedSequenceId': unexecutedSequenceInfo.contractId },
            address: addressFromContractId(parentId),
            existingContracts: unexecutedSequenceInfo.states(),
            inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
        })

        expect(testResult.contracts.length).toEqual(1)
        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0]
        expect(event.name).toEqual('ContractDestroyed')
        expect(event.fields['address']).toEqual(unexecutedSequenceInfo.address)
    })

    it('should only parent contract can call these methods', async () => {
        await buildProject(provider)
        const parentId = randomContractId()
        const refundAddress = randomAssetAddress()
        const unexecutedSequenceInfo = createUnexecutedSequence(randomContractId(), 0, 0n, refundAddress)
        const unexecutedSequenceTest = Project.contract('tests/unexecuted_sequence_test.ral')
        expectAssertionFailed(async () => {
            await unexecutedSequenceTest.testPublicMethod('checkSequence', {
                initialFields: { 'unexecutedSequenceId': unexecutedSequenceInfo.contractId },
                address: addressFromContractId(parentId),
                testArgs: { 'seq': 1n },
                existingContracts: unexecutedSequenceInfo.states(),
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            })
        })
        expectAssertionFailed(async () => {
            await unexecutedSequenceTest.testPublicMethod('destroy', {
                initialFields: { 'unexecutedSequenceId': unexecutedSequenceInfo.contractId },
                address: addressFromContractId(parentId),
                existingContracts: unexecutedSequenceInfo.states(),
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            })
        })
    })
})

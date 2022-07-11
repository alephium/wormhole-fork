import { NodeProvider, Contract, Number256, addressFromContractId } from '@alephium/web3'
import { createUndoneSequence } from './fixtures/sequence-fixture'
import { expectAssertionFailed, oneAlph, randomAssetAddress, randomContractId } from './fixtures/wormhole-fixture'

describe("test undone sequence", () => {
    const provider = new NodeProvider('http://127.0.0.1:22973')
    const allExecuted = (BigInt(1) << BigInt(256)) - 1n

    it('should check sequence passed', async () => {
        const parentId = randomContractId()
        const refundAddress = randomAssetAddress()
        const startSequence = 256
        let sequences = 0n
        for (let seq = 0; seq < 255; seq++) {
            const undoneSequenceInfo = await createUndoneSequence(provider, parentId, startSequence, sequences, refundAddress)
            const undoneSequenceTest = await Contract.fromSource(provider, 'undone_sequence_test.ral')
            const testResult = await undoneSequenceTest.testPublicMethod(provider, 'check', {
                initialFields: { 'undoneSequenceId': undoneSequenceInfo.contractId },
                address: addressFromContractId(parentId),
                testArgs: { 'seq': seq + startSequence },
                existingContracts: undoneSequenceInfo.states(),
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            })
            sequences = sequences + (1n << BigInt(seq))
            const undoneSequence = testResult.contracts[0]
            expect(BigInt(undoneSequence.fields['sequences'] as Number256)).toEqual(sequences)
        }
    }, 50000)

    it('should check sequence failed if sequence executed', async () => {
        const parentId = randomContractId()
        const refundAddress = randomAssetAddress()
        const startSequence = 256
        for (let seq = 0; seq < 256; seq++) {
            const sequences = 1n << BigInt(seq)
            const undoneSequenceInfo = await createUndoneSequence(provider, parentId, startSequence, sequences, refundAddress)
            const undoneSequenceTest = await Contract.fromSource(provider, 'undone_sequence_test.ral')
            expectAssertionFailed(async () => await undoneSequenceTest.testPublicMethod(provider, 'check', {
                initialFields: { 'undoneSequenceId': undoneSequenceInfo.contractId },
                address: addressFromContractId(parentId),
                testArgs: { 'seq': seq + startSequence },
                existingContracts: undoneSequenceInfo.states(),
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            }))
        }
    }, 60000)

    it('should check sequence failed if sequence is out of range', async () => {
        const parentId = randomContractId()
        const refundAddress = randomAssetAddress()
        const startSequence = 256
        const sequences = [0, startSequence - 1, startSequence * 2, startSequence * 10]
        for (let seq of sequences) {
            const undoneSequenceInfo = await createUndoneSequence(provider, parentId, startSequence, 0n, refundAddress)
            const undoneSequenceTest = await Contract.fromSource(provider, 'undone_sequence_test.ral')
            expectAssertionFailed(async () => await undoneSequenceTest.testPublicMethod(provider, 'check', {
                initialFields: { 'undoneSequenceId': undoneSequenceInfo.contractId },
                address: addressFromContractId(parentId),
                testArgs: { 'seq': seq },
                existingContracts: undoneSequenceInfo.states(),
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            }))
        }
    })

    it('should destroy contract if all sequences executed', async () => {
        const parentId = randomContractId()
        const refundAddress = randomAssetAddress()
        const startSequence = 0
        const undoneSequenceOffset = 1
        const sequences = allExecuted - (1n << BigInt(undoneSequenceOffset))
        const undoneSequenceInfo = await createUndoneSequence(provider, parentId, startSequence, sequences, refundAddress)
        const undoneSequenceTest = await Contract.fromSource(provider, 'undone_sequence_test.ral')
        const testResult = await undoneSequenceTest.testPublicMethod(provider, 'check', {
            initialFields: { 'undoneSequenceId': undoneSequenceInfo.contractId },
            address: addressFromContractId(parentId),
            testArgs: { 'seq': startSequence + undoneSequenceOffset },
            existingContracts: undoneSequenceInfo.states(),
            inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
        })

        expect(testResult.contracts.length).toEqual(1)
        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0]
        expect(event.name).toEqual('ContractDestroyed')
        expect(event.fields['address']).toEqual(undoneSequenceInfo.address)
    })

    it('should destroy contract manually', async () => {
        const parentId = randomContractId()
        const refundAddress = randomAssetAddress()
        const undoneSequenceInfo = await createUndoneSequence(provider, parentId, 0, 0n, refundAddress)
        const undoneSequenceTest = await Contract.fromSource(provider, 'undone_sequence_test.ral')
        const testResult = await undoneSequenceTest.testPublicMethod(provider, 'destroy', {
            initialFields: { 'undoneSequenceId': undoneSequenceInfo.contractId },
            address: addressFromContractId(parentId),
            existingContracts: undoneSequenceInfo.states(),
            inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
        })

        expect(testResult.contracts.length).toEqual(1)
        expect(testResult.events.length).toEqual(1)
        const event = testResult.events[0]
        expect(event.name).toEqual('ContractDestroyed')
        expect(event.fields['address']).toEqual(undoneSequenceInfo.address)
    })

    it('should only parent contract can call these methods', async () => {
        const parentId = randomContractId()
        const refundAddress = randomAssetAddress()
        const undoneSequenceInfo = await createUndoneSequence(provider, randomContractId(), 0, 0n, refundAddress)
        const undoneSequenceTest = await Contract.fromSource(provider, 'undone_sequence_test.ral')
        expectAssertionFailed(async () => {
            await undoneSequenceTest.testPublicMethod(provider, 'check', {
                initialFields: { 'undoneSequenceId': undoneSequenceInfo.contractId },
                address: addressFromContractId(parentId),
                testArgs: { 'seq': 1n },
                existingContracts: undoneSequenceInfo.states(),
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            })
        })
        expectAssertionFailed(async () => {
            await undoneSequenceTest.testPublicMethod(provider, 'destroy', {
                initialFields: { 'undoneSequenceId': undoneSequenceInfo.contractId },
                address: addressFromContractId(parentId),
                existingContracts: undoneSequenceInfo.states(),
                inputAssets: [{address: refundAddress, asset: {alphAmount: oneAlph}}]
            })
        })
    })
})

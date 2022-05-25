import { NodeProvider, Contract } from 'alephium-web3'
import { createSequence, createUndoneSequence } from './fixtures/sequence-fixture'
import { createEventEmitter, expectAssertionFailed, randomContractAddress, randomContractId, toContractId } from './fixtures/wormhole-fixture'

describe("test sequence", () => {
    const provider = new NodeProvider('http://127.0.0.1:22973')
    const allExecuted = (BigInt(1) << BigInt(256)) - 1n

    function sequenceToHex(seq: number): string {
        const buffer = Buffer.allocUnsafe(8)
        buffer.writeBigUInt64BE(BigInt(seq), 0)
        return buffer.toString('hex')
    }

    test("should init undone sequence", async () => {
        const eventEmitter = await createEventEmitter(provider)
        const sequenceAddress = randomContractAddress()
        const undoneSequence = await createUndoneSequence(provider, sequenceAddress)
        const sequence = await Contract.fromSource(provider, 'sequence.ral')
        const testResult = await sequence.testPublicMethod(provider, 'init', {
            initialFields: {
                'next': 0,
                'next1': 0,
                'next2': 0,
                'undoneSequenceId': '',
                'undoneSequenceCodeHash': undoneSequence.codeHash,
                'eventEmitterId': eventEmitter.contractId
            },
            address: sequenceAddress,
            testArgs: { 'contractId': undoneSequence.selfState.contractId },
            existingContracts: [undoneSequence.selfState]
        })
        const undoneSequenceOutput = testResult.contracts[0]
        expect(undoneSequenceOutput.fields['owner']).toEqual(toContractId(sequenceAddress))
        const sequenceOutput = testResult.contracts[1]
        expect(sequenceOutput.fields['undoneSequenceId']).toEqual(undoneSequence.selfState.contractId)

        await expectAssertionFailed(async () => {
            await sequence.testPublicMethod(provider, 'init', {
                initialFields: {
                    'next': 0,
                    'next1': 0,
                    'next2': 0,
                    'undoneSequenceId': undoneSequence.selfState.contractId,
                    'undoneSequenceCodeHash': undoneSequence.codeHash,
                    'eventEmitterId': eventEmitter.contractId
                },
                address: sequenceAddress,
                testArgs: { 'contractId': randomContractId() },
                existingContracts: [undoneSequence.selfState]
            })
        })
    })

    test("should execute correctly", async () => {
        const eventEmitter = await createEventEmitter(provider)
        const sequenceInfo = await createSequence(provider, eventEmitter, 0, 0n, 0n)
        const sequence = sequenceInfo.contract
        for (let seq = 0; seq < 256; seq++) {
            const testResult = await sequence.testPrivateMethod(provider, 'checkSequence', {
                initialFields: sequenceInfo.selfState.fields,
                address: sequenceInfo.address,
                testArgs: { 'seq': seq }
            })
            // won't load undone sequence contract in normal case
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
                testArgs: { 'seq': seq }
            })
            // won't load undone sequence contract in normal case
            expect(testResult.contracts.length).toEqual(1)
            expect(testResult.contracts[0].fields['next']).toEqual(0)
            expect(testResult.contracts[0].fields['next1']).toEqual(0)
            const next2 = BigInt(1) << BigInt(seq - 256)
            expect(testResult.contracts[0].fields['next2'].toString()).toEqual(next2.toString())
            expect(testResult.events.length).toEqual(0)
        }
    }, 90000)

    it('should failed if sequence too large', async () => {
        const eventEmitter = await createEventEmitter(provider)
        const sequenceInfo = await createSequence(provider, eventEmitter, 0, allExecuted, 0n)
        const sequence = sequenceInfo.contract
        await expectAssertionFailed(async() => {
            await sequence.testPrivateMethod(provider, 'checkSequence', {
                initialFields: sequenceInfo.selfState.fields,
                address: sequenceInfo.address,
                testArgs: { 'seq': 1024 },
                existingContracts: sequenceInfo.dependencies
            })
        })
    })

    it('should move sequences to undone list', async () => {
        const next1 = (BigInt(0xff) << 248n)
        const currentSeq = 513
        const eventEmitter = await createEventEmitter(provider)
        const sequenceInfo = await createSequence(
            provider, eventEmitter, 0, next1, 0n, "", 100, 513 - (248 - 50)
        )
        const sequence = sequenceInfo.contract
        const testResult = await sequence.testPrivateMethod(provider, 'checkSequence', {
            initialFields: sequenceInfo.selfState.fields,
            address: sequenceInfo.address,
            testArgs: { 'seq': currentSeq },
            existingContracts: sequenceInfo.dependencies
        })
        let undoneList = ""
        for (let seq = 248 - 1; seq >= 248 - 50; seq--) {
            undoneList = sequenceToHex(seq) + undoneList
        }
        expect(testResult.contracts[0].fields['undone']).toEqual(undoneList)
        expect(testResult.contracts[2].fields['next']).toEqual(256)
        expect(testResult.contracts[2].fields['next1']).toEqual(0)
        expect(testResult.contracts[2].fields['next2']).toEqual(2)
        expect(testResult.events.length).toEqual(1)

        let removed = ""
        for (let seq = 0; seq < 248 - 50; seq++) {
            removed = removed + sequenceToHex(seq)
        }
        const event = testResult.events[0]
        expect(event.fields['sender']).toEqual(toContractId(sequenceInfo.address))
        expect(event.fields['sequences']).toEqual(removed)
    })

    it('should set sequence to done', async () => {
        const eventEmitter = await createEventEmitter(provider)
        const sequenceInfo = await createSequence(
            provider, eventEmitter, 256, 0n, 0n, sequenceToHex(12) + sequenceToHex(15)
        )
        const sequence = sequenceInfo.contract
        const testResult = await sequence.testPrivateMethod(provider, 'checkSequence', {
            initialFields: sequenceInfo.selfState.fields,
            address: sequenceInfo.address,
            testArgs: { 'seq': 12 },
            existingContracts: sequenceInfo.dependencies
        })
        expect(testResult.contracts[0].fields['undone']).toEqual(sequenceToHex(15))
        expect(testResult.contracts[2].fields['next']).toEqual(256)
        expect(testResult.contracts[2].fields['next1']).toEqual(0)
        expect(testResult.contracts[2].fields['next2']).toEqual(0)
        expect(testResult.events.length).toEqual(0)

        await expectAssertionFailed(async() => {
            await sequence.testPrivateMethod(provider, 'checkSequence', {
                initialFields: sequenceInfo.selfState.fields,
                address: sequenceInfo.address,
                testArgs: { 'seq': 14 },
                existingContracts: sequenceInfo.dependencies
            })
        })
    })

    it("should increase executed sequence", async () => {
        const eventEmitter = await createEventEmitter(provider)
        const sequenceInfo = await createSequence(provider, eventEmitter, 512, allExecuted, allExecuted)
        const sequence = sequenceInfo.contract
        const testResult = await sequence.testPrivateMethod(provider, 'checkSequence', {
            initialFields: sequenceInfo.selfState.fields,
            address: sequenceInfo.address,
            testArgs: { 'seq': 1025 }
        })
        expect(testResult.contracts.length).toEqual(1)
        expect(testResult.contracts[0].fields['next']).toEqual(512 + 256)
        expect(testResult.contracts[0].fields['next1']).toEqual(allExecuted)
        expect(testResult.contracts[0].fields['next2']).toEqual(2)
        expect(testResult.events.length).toEqual(0)
    })

    test("should failed when executed repeatedly", async () => {
        const eventEmitter = await createEventEmitter(provider)
        const sequenceInfo = await createSequence(provider, eventEmitter, 0, allExecuted, 0n)
        const sequence = sequenceInfo.contract
        for (let seq = 0; seq < 256; seq++) {
            await expectAssertionFailed(async() => {
                return await sequence.testPrivateMethod(provider, "checkSequence", {
                    initialFields: sequenceInfo.selfState.fields,
                    address: sequenceInfo.address,
                    testArgs: { 'seq': seq },
                    existingContracts: sequenceInfo.dependencies
                })
            })
        }

        const undoneSequenceCodeHash = sequenceInfo.selfState.fields['undoneSequenceCodeHash']
        const eventEmitterId = sequenceInfo.selfState.fields['eventEmitterId']
        for (let seq = 256; seq < 512; seq++) {
            await expectAssertionFailed(async() => {
                return await sequence.testPrivateMethod(provider, "checkSequence", {
                    initialFields: {
                        'next': 0,
                        'next1': 0,
                        'next2': allExecuted,
                        'undoneSequenceId': '',
                        'undoneSequenceCodeHash': undoneSequenceCodeHash,
                        'eventEmitterId': eventEmitterId
                    },
                    address: sequenceInfo.address,
                    testArgs: { 'seq': seq },
                    existingContracts: sequenceInfo.dependencies
                })
            })
        }

        for (let seq = 0; seq < 512; seq++) {
            await expectAssertionFailed(async() => {
                return await sequence.testPrivateMethod(provider, "checkSequence", {
                    initialFields: {
                        'next': 512,
                        'next1': 0,
                        'next2': 0,
                        'undoneSequenceId': '',
                        'undoneSequenceCodeHash': undoneSequenceCodeHash,
                        'eventEmitterId': eventEmitterId
                    },
                    address: sequenceInfo.address,
                    testArgs: { 'seq': seq },
                    existingContracts: sequenceInfo.dependencies
                })
            })
        }
    }, 180000)
})

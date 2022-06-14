import { NodeProvider, Contract } from '@alephium/web3'
import { createUndoneSequence } from './fixtures/sequence-fixture'
import { expectAssertionFailed, randomContractAddress, randomContractId } from './fixtures/wormhole-fixture'

describe("test undone sequence", () => {
    const provider = new NodeProvider('http://127.0.0.1:22973')
    const contractAddress = randomContractAddress()

    function sequenceToHex(seq: number): string {
        const buffer = Buffer.allocUnsafe(8)
        buffer.writeBigUInt64BE(BigInt(seq), 0)
        return buffer.toString('hex')
    }

    test("add sequence to undone list", async () => {
        const owner = randomContractId()
        const undoneSequenceInfo = await createUndoneSequence(provider, owner)
        const undoneSequence = undoneSequenceInfo.contract
        let undoneList = ""
        let sequences = [1, 3, 4, 5]
        for (let index = 0; index < 4; index++) {
            let testResult = await undoneSequence.testPrivateMethod(provider, 'add', {
                initialFields: {
                    "owner": owner,
                    "undone": undoneList,
                    "undoneSequenceMaxSize": 2,
                    "undoneSequenceMaxDistance": 32 
                },
                address: contractAddress,
                testArgs: { 'seq': sequences[index] }
            })
            let state = testResult.contracts[0].fields['undone']
            if (index >= 2) {
                let removedIndex = index - 2
                expect(testResult.returns).toEqual([sequenceToHex(sequences[removedIndex])])
                expect(state).toEqual(sequences.slice(index - 1, index + 1).map(seq => sequenceToHex(seq)).join(""))
            } else {
                expect(testResult.returns).toEqual([""])
                expect(state).toEqual(sequences.slice(0, index + 1).map(seq => sequenceToHex(seq)).join(""))
            }
            undoneList = state as string
        }

        const invalids = [2, 4]
        for (let index = 0; index < 2; index++) {
            await expectAssertionFailed(async () => {
                await undoneSequence.testPrivateMethod(provider, 'add', {
                    initialFields: {
                        "owner": owner,
                        "undone": undoneList,
                        "undoneSequenceMaxSize": 2,
                        "undoneSequenceMaxDistance": 32 
                    },
                    address: contractAddress,
                    testArgs: { 'seq': invalids[index] },
                })
            })
        }
    })

    test("add sequences bit map to undone list", async () => {
        const owner = randomContractId()
        const undoneSequenceInfo = await createUndoneSequence(provider, owner, '', 4, 32)
        const undoneSequence = undoneSequenceInfo.contract
        const baseSeq = 100
        const bitMap = 0x0c // 00001100
        let testResult = await undoneSequence.testPrivateMethod(provider, 'addSequences', {
            initialFields: undoneSequenceInfo.selfState.fields,
            address: contractAddress,
            testArgs: {
                'seq': baseSeq,
                'bitMap': bitMap,
            }
        })
        let state = testResult.contracts[0].fields['undone']
        expect(state).toEqual([104, 105, 106, 107].map(seq => sequenceToHex(seq)).join(""))
        expect(testResult.returns).toEqual([sequenceToHex(100) + sequenceToHex(101)])
    })

    test("add sequences to undone list", async () => {
        const distance = 16
        const maxSize = 32
        const undoneSequenceInfo = await createUndoneSequence(provider, contractAddress, "", maxSize, distance)
        const undoneSequenceTest = await Contract.fromSource(provider, 'undone_sequence_test.ral')

        const bitMap = BigInt("0xff") << 248n
        let testResult = await undoneSequenceTest.testPublicMethod(provider, 'addToUndone_', {
            initialFields: { 'undoneSequenceId': undoneSequenceInfo.contractId },
            address: contractAddress,
            testArgs: {
                'seq': 0,
                'current': 248,
                'bitMap': bitMap
            },
            existingContracts: undoneSequenceInfo.states()
        })
        let undoneList = ""
        for (let seq = 248 - 1; seq >= 248 - distance; seq--) {
            undoneList = sequenceToHex(seq) + undoneList
        }
        expect(testResult.contracts[0].fields['undone']).toEqual(undoneList)

        let removed = ""
        for (let seq = 0; seq < 248 - distance; seq++) {
            removed += sequenceToHex(seq)
        }
        expect(testResult.returns).toEqual([removed])
    })

    test("remove old undone sequences", async () => {
        const owner = randomContractId()
        const undoneSequenceInfo = await createUndoneSequence(provider, owner)
        const undoneSequence = undoneSequenceInfo.contract
        let testResult = await undoneSequence.testPrivateMethod(provider, 'removeOldUndone', {
            initialFields: {
                "owner": owner,
                "undone": '',
                "undoneSequenceMaxSize": 2,
                "undoneSequenceMaxDistance": 32 
            },
            address: contractAddress,
            testArgs: { 'current': 10 }
        })
        expect(testResult.contracts[0].fields['undone']).toEqual("")
        expect(testResult.returns).toEqual([""])

        const undoneList = sequenceToHex(10) + sequenceToHex(12) + sequenceToHex(20)
        testResult = await undoneSequence.testPrivateMethod(provider, 'removeOldUndone', {
            initialFields: {
                "owner": owner,
                "undone": undoneList,
                "undoneSequenceMaxSize": 2,
                "undoneSequenceMaxDistance": 32 
            },
            address: contractAddress,
            testArgs: { 'current': 50 }
        })
        expect(testResult.contracts[0].fields['undone']).toEqual(sequenceToHex(20))
        expect(testResult.returns).toEqual([sequenceToHex(10) + sequenceToHex(12)])
    })

    test("try to set done", async () => {
        let undoneSequenceInfo = await createUndoneSequence(provider, contractAddress)
        const undoneSequenceTest = await Contract.fromSource(provider, 'undone_sequence_test.ral')

        let testResult = await undoneSequenceTest.testPublicMethod(provider, 'trySetDone_', {
            initialFields: { 'undoneSequenceId': undoneSequenceInfo.contractId },
            address: contractAddress,
            testArgs: { 'seq': 10 },
            existingContracts: undoneSequenceInfo.states()
        })
        expect(testResult.contracts[0].fields['undone']).toEqual("")
        expect(testResult.returns).toEqual([false])

        const undoneSequences = [10, 11, 12, 13, 20, 22, 25, 30]
        const undoneList = undoneSequences.map(seq => sequenceToHex(seq)).join("")
        undoneSequenceInfo = await createUndoneSequence(provider, contractAddress, undoneList)
        const faileds = [1, 14, 21, 23, 28, 33]
        for (let seq of faileds) {
            testResult = await undoneSequenceTest.testPublicMethod(provider, 'trySetDone_', {
                initialFields: { 'undoneSequenceId': undoneSequenceInfo.contractId },
                address: contractAddress,
                testArgs: { 'seq': seq },
                existingContracts: undoneSequenceInfo.states()
            })
            expect(testResult.contracts[0].fields['undone']).toEqual(undoneList)
            expect(testResult.returns).toEqual([false])
        }

        for (let index = 0; index < undoneSequences.length; index++) {
            undoneSequenceInfo = await createUndoneSequence(provider, contractAddress, undoneList.slice(index * 16))
            testResult = await undoneSequenceTest.testPublicMethod(provider, 'trySetDone_', {
                initialFields: { 'undoneSequenceId': undoneSequenceInfo.contractId },
                address: contractAddress,
                testArgs: { 'seq': undoneSequences[index] },
                existingContracts: undoneSequenceInfo.states()
            })
            expect(testResult.returns).toEqual([true])
            expect(testResult.contracts[0].fields['undone']).toEqual(undoneList.slice((index + 1) * 16))
        }
    })
})

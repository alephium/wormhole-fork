import { CliqueClient, Contract } from 'alephium-web3'
import { expectAssertionFailed, randomContractAddress } from './fixtures/wormhole-fixture'

describe("test undone sequence", () => {
    const client = new CliqueClient({baseUrl: `http://127.0.0.1:22973`})
    const contractAddress = randomContractAddress()

    function sequenceToHex(seq: number): string {
        const buffer = Buffer.allocUnsafe(8)
        buffer.writeBigUInt64BE(BigInt(seq), 0)
        return buffer.toString('hex')
    }

    test("add sequence to undone list", async () => {
        const undoneSequencetTest = await Contract.from(client, 'undone_sequence.ral', {
            distance: 32
        })
        let testResult = await undoneSequencetTest.testPrivateMethod(client, 'add', {
            initialFields: [""],
            address: contractAddress,
            testArgs: [1]
        })
        let undoneList = testResult.contracts[0].fields[0]
        expect(undoneList).toEqual(sequenceToHex(1))

        testResult = await undoneSequencetTest.testPrivateMethod(client, 'add', {
            initialFields: [undoneList],
            address: contractAddress,
            testArgs: [3]
        })
        undoneList = testResult.contracts[0].fields[0]
        expect(undoneList).toEqual(sequenceToHex(1) + sequenceToHex(3))

        const invalids = [2, 3]
        invalids.forEach(async seq => {
            await expectAssertionFailed(async () => {
                await undoneSequencetTest.testPrivateMethod(client, 'add', {
                    initialFields: [undoneList],
                    address: contractAddress,
                    testArgs: [seq]
                })
            })
        })
    })

    test("add sequences to undone list", async () => {
        const undoneSequencetTest = await Contract.from(client, 'undone_sequence.ral', {
            distance: 32
        })

        const bitMap = BigInt("0xff") << 8n
        let testResult = await undoneSequencetTest.testPrivateMethod(client, 'addToUndone', {
            initialFields: [""],
            address: contractAddress,
            testArgs: [10, bitMap]
        })
        let undoneList = ""
        for (let seq = 10; seq < 18; seq++) {
            undoneList += sequenceToHex(seq)
        }
        for (let seq = 26; seq < 266; seq++){
            undoneList += sequenceToHex(seq)
        }
        expect(testResult.contracts[0].fields).toEqual([undoneList])
    })

    test("remove old undone sequences", async () => {
        const undoneSequencetTest = await Contract.from(client, 'undone_sequence.ral', {
            distance: 32
        })

        let testResult = await undoneSequencetTest.testPrivateMethod(client, 'removeOldUndone', {
            initialFields: [""],
            address: contractAddress,
            testArgs: [10]
        })
        expect(testResult.contracts[0].fields).toEqual([""])

        const undoneList = sequenceToHex(10) + sequenceToHex(12) + sequenceToHex(20)
        testResult = await undoneSequencetTest.testPrivateMethod(client, 'removeOldUndone', {
            initialFields: [undoneList],
            address: contractAddress,
            testArgs: [50]
        })
        expect(testResult.contracts[0].fields).toEqual([sequenceToHex(20)])
        expect(testResult.events.length).toEqual(2)
        expect(testResult.events[0].fields).toEqual([10])
        expect(testResult.events[1].fields).toEqual([12])
    })

    test("try to set done", async () => {
        const undoneSequencetTest = await Contract.from(client, 'undone_sequence.ral', {
            distance: 32
        })

        let testResult = await undoneSequencetTest.testPrivateMethod(client, 'trySetDone', {
            initialFields: [""],
            address: contractAddress,
            testArgs: [10]
        })
        expect(testResult.contracts[0].fields).toEqual([""])
        expect(testResult.returns).toEqual([false])

        const undoneSequences = [10, 11, 12, 13, 20, 22, 25, 30]
        const undoneList = undoneSequences.map(seq => sequenceToHex(seq)).join("")
        const faileds = [1, 14, 21, 23, 28, 33]
        faileds.forEach(async seq => {
            testResult = await undoneSequencetTest.testPrivateMethod(client, 'trySetDone', {
                initialFields: [undoneList],
                address: contractAddress,
                testArgs: [seq]
            })
            expect(testResult.returns).toEqual([false])
            expect(testResult.contracts[0].fields).toEqual([undoneList])
        })

        undoneSequences.forEach(async (seq, index) => {
            testResult = await undoneSequencetTest.testPrivateMethod(client, 'trySetDone', {
                initialFields: [undoneList.slice(index * 16)],
                address: contractAddress,
                testArgs: [seq]
            })
            expect(testResult.returns).toEqual([true])
            expect(testResult.contracts[0].fields).toEqual([undoneList.slice((index + 1) * 16)])
        })
    })
})

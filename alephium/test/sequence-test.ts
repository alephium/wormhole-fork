import { CliqueClient, Contract } from 'alephium-web3'
import { expectAssertionFailed, randomContractAddress } from './fixtures/wormhole-fixture'

describe("test sequence", () => {
    const client = new CliqueClient({baseUrl: `http://127.0.0.1:22973`})
    const sequenceTestAddress = randomContractAddress()
    const allExecuted = (BigInt(1) << BigInt(256)) - 1n

    function sequenceToHex(seq: number): string {
        const buffer = Buffer.allocUnsafe(8)
        buffer.writeBigUInt64BE(BigInt(seq), 0)
        return buffer.toString('hex')
    }

    test("should execute correctly", async () => {
        const sequenceTest = await Contract.from(client, 'sequence.ral', { distance: 32 })
        const initFields = [0, 0, 0, '']
        for (let seq = 0; seq < 256; seq++) {
            const testResult = await sequenceTest.testPrivateMethod(client, 'checkSequence', {
                initialFields: initFields,
                address: sequenceTestAddress,
                testArgs: [seq]
            })
            expect(testResult.contracts[0].fields[0]).toEqual(0)
            const next1 = BigInt(1) << BigInt(seq)
            expect(testResult.contracts[0].fields[1].toString()).toEqual(next1.toString())
            expect(testResult.contracts[0].fields[2]).toEqual(0)
            expect(testResult.contracts[0].fields[3]).toEqual('')
            expect(testResult.events.length).toEqual(0)
        }

        for (let seq = 256; seq < 512; seq++) {
            const testResult = await sequenceTest.testPrivateMethod(client, 'checkSequence', {
                initialFields: initFields,
                address: sequenceTestAddress,
                testArgs: [seq]
            })
            expect(testResult.contracts[0].fields[0]).toEqual(0)
            expect(testResult.contracts[0].fields[1]).toEqual(0)
            const next2 = BigInt(1) << BigInt(seq - 256)
            expect(testResult.contracts[0].fields[2].toString()).toEqual(next2.toString())
            expect(testResult.contracts[0].fields[3]).toEqual('')
            expect(testResult.events.length).toEqual(0)
        }
    }, 90000)

    it('should failed if sequence too large', async () => {
        const sequenceTest = await Contract.from(client, 'sequence.ral', { distance: 32 })
        const initFields = [0, allExecuted, 0, '']
        await expectAssertionFailed(async() => {
            await sequenceTest.testPrivateMethod(client, 'checkSequence', {
                initialFields: initFields,
                address: sequenceTestAddress,
                testArgs: [1024]
            })
        })
    })

    it('should move sequences to undone list', async () => {
        const sequenceTest = await Contract.from(client, 'sequence.ral', { distance: 512 })
        const next1 = (BigInt(1) << 253n) - BigInt(1)
        const oldUndoneSequence = 0
        const initFields = [0, next1, 0, sequenceToHex(oldUndoneSequence)]
        const testResult = await sequenceTest.testPrivateMethod(client, 'checkSequence', {
            initialFields: initFields,
            address: sequenceTestAddress,
            testArgs: [513]
        })
        expect(testResult.contracts[0].fields[0]).toEqual(256)
        expect(testResult.contracts[0].fields[1]).toEqual(0)
        expect(testResult.contracts[0].fields[2]).toEqual(2)
        expect(testResult.contracts[0].fields[3]).toEqual(sequenceToHex(253) + sequenceToHex(254) + sequenceToHex(255))
        expect(testResult.events.length).toEqual(1)

        const event = testResult.events[0]
        expect(event.fields).toEqual([oldUndoneSequence])
    })

    it('should set sequence to done', async () => {
        const sequenceTest = await Contract.from(client, 'sequence.ral', { distance: 512 })
        const initFields = [256, 0, 0, sequenceToHex(12) + sequenceToHex(15)]
        const testResult = await sequenceTest.testPrivateMethod(client, 'checkSequence', {
            initialFields: initFields,
            address: sequenceTestAddress,
            testArgs: [12]
        })
        expect(testResult.contracts[0].fields[0]).toEqual(256)
        expect(testResult.contracts[0].fields[1]).toEqual(0)
        expect(testResult.contracts[0].fields[2]).toEqual(0)
        expect(testResult.contracts[0].fields[3]).toEqual(sequenceToHex(15))
        expect(testResult.events.length).toEqual(0)

        await expectAssertionFailed(async() => {
            await sequenceTest.testPrivateMethod(client, 'checkSequence', {
                initialFields: initFields,
                address: sequenceTestAddress,
                testArgs: [14]
            })
        })
    })

    it("should increase executed sequence", async () => {
        const sequenceTest = await Contract.from(client, 'sequence.ral', { distance: 32 })
        const initFields = [512, allExecuted, allExecuted, '']
        const testResult = await sequenceTest.testPrivateMethod(client, 'checkSequence', {
            initialFields: initFields,
            address: sequenceTestAddress,
            testArgs: [1025]
        })
        expect(testResult.contracts[0].fields[0]).toEqual(512 + 256)
        expect(testResult.contracts[0].fields[1]).toEqual(allExecuted)
        expect(testResult.contracts[0].fields[2]).toEqual(2)
        expect(testResult.contracts[0].fields[3]).toEqual('')
        expect(testResult.events.length).toEqual(0)
    })

    test("should fail when executed repeatedly", async () => {
        const sequenceTest = await Contract.from(client, 'sequence.ral', { distance: 32 })
        const initFields0 = [0, allExecuted, 0, '']
        for (let seq = 0; seq < 256; seq++) {
            await expectAssertionFailed(async() => {
                return await sequenceTest.testPrivateMethod(client, "checkSequence", {
                    initialFields: initFields0,
                    address: sequenceTestAddress,
                    testArgs: [seq]
                })
            })
        }

        const initFields1 = [0, 0, allExecuted, '']
        for (let seq = 256; seq < 512; seq++) {
            await expectAssertionFailed(async() => {
                return await sequenceTest.testPrivateMethod(client, "checkSequence", {
                    initialFields: initFields1,
                    address: sequenceTestAddress,
                    testArgs: [seq]
                })
            })
        }

        const initFields2 = [512, 0, 0, '']
        for (let seq = 0; seq < 512; seq++) {
            await expectAssertionFailed(async() => {
                return await sequenceTest.testPrivateMethod(client, "checkSequence", {
                    initialFields: initFields2,
                    address: sequenceTestAddress,
                    testArgs: [seq]
                })
            })
        }
    }, 180000)
})

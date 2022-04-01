import { CliqueClient, Contract } from 'alephium-js'
import { expectAssertionFailed, randomContractAddress } from './fixtures/wormhole-fixture'

describe("test sequence", () => {
    const client = new CliqueClient({baseUrl: `http://127.0.0.1:22973`})
    const sequenceTestAddress = randomContractAddress()
    const allExecuted = (BigInt(1) << BigInt(256)) - 1n

    test("should execute correctly", async () => {
        const sequenceTest = await Contract.from(client, 'sequence_test.ral')
        const initFields = [0, 0, 0]
        for (let seq = 0; seq < 256; seq++) {
            const testResult = await sequenceTest.test(client, 'check', {
                initialFields: initFields,
                address: sequenceTestAddress,
                testArgs: [seq]
            })
            expect(testResult.contracts[0].fields[0]).toEqual(0)
            let next1 = BigInt(1) << BigInt(seq)
            expect(testResult.contracts[0].fields[1].toString()).toEqual(next1.toString())
            expect(testResult.contracts[0].fields[2]).toEqual(0)
        }

        for (let seq = 256; seq < 512; seq++) {
            const testResult = await sequenceTest.test(client, 'check', {
                initialFields: initFields,
                address: sequenceTestAddress,
                testArgs: [seq]
            })
            expect(testResult.contracts[0].fields[0]).toEqual(0)
            expect(testResult.contracts[0].fields[1]).toEqual(0)
            let next2 = BigInt(1) << BigInt(seq - 256)
            expect(testResult.contracts[0].fields[2].toString()).toEqual(next2.toString())
        }
    }, 90000)

    it("should increase executed sequence", async () => {
        const sequenceTest = await Contract.from(client, 'sequence_test.ral')
        const initFields = [512, allExecuted, allExecuted]
        const testResult = await sequenceTest.test(client, 'check', {
            initialFields: initFields,
            address: sequenceTestAddress,
            testArgs: [1025]
        })
        expect(testResult.contracts[0].fields[0]).toEqual(512 + 256)
        expect(testResult.contracts[0].fields[1]).toEqual(allExecuted)
        expect(testResult.contracts[0].fields[2]).toEqual(2)
    })

    test("should fail when executed repeatedly", async () => {
        const sequenceTest = await Contract.from(client, 'sequence_test.ral')
        const initFields0 = [0, allExecuted, 0]
        for (let seq = 0; seq < 256; seq++) {
            expectAssertionFailed(async() => {
                return await sequenceTest.test(client, "check", {
                    initialFields: initFields0,
                    address: sequenceTestAddress,
                    testArgs: [seq]
                })
            })
        }

        const initFields1 = [0, 0, allExecuted]
        for (let seq = 256; seq < 512; seq++) {
            expectAssertionFailed(async() => {
                return await sequenceTest.test(client, "check", {
                    initialFields: initFields1,
                    address: sequenceTestAddress,
                    testArgs: [seq]
                })
            })
        }

        const initFields2 = [512, 0, 0]
        for (let seq = 0; seq < 512; seq++) {
            expectAssertionFailed(async() => {
                return await sequenceTest.test(client, "check", {
                    initialFields: initFields2,
                    address: sequenceTestAddress,
                    testArgs: [seq]
                })
            })
        }
    }, 10000)
})

import { CliqueClient, Contract } from 'alephium-js'
import { expectAssertionFailed, randomContractAddress, toContractId } from './fixtures/wormhole-fixture'

describe("test sequence", () => {
    const client = new CliqueClient({baseUrl: `http://127.0.0.1:22973`})
    const sequenceTestAddress = randomContractAddress()

    test("should execute correctly", async () => {
        const sequenceTest = await Contract.from(client, 'sequence_test.ral')
        const initFields = [0, Array(20).fill(false), Array(20).fill(false)]
        for (let seq of Array.from(Array(20).keys()).reverse()) {
            const testResult = await sequenceTest.test(client, 'check', {
                initialFields: initFields,
                address: sequenceTestAddress,
                testArgs: [seq]
            })
            expect(testResult.contracts[0].fields[0]).toEqual(0)
            let next1 = Array(20).fill(false)
            next1[seq] = true
            expect(testResult.contracts[0].fields[1]).toEqual(next1)
            expect(testResult.contracts[0].fields[2]).toEqual(Array(20).fill(false))
        }

        for (let seq of Array.from(Array(40).keys()).slice(20)) {
            const testResult = await sequenceTest.test(client, 'check', {
                initialFields: initFields,
                address: sequenceTestAddress,
                testArgs: [seq]
            })
            expect(testResult.contracts[0].fields[0]).toEqual(0)
            expect(testResult.contracts[0].fields[1]).toEqual(Array(20).fill(false))
            let next2 = Array(20).fill(false)
            next2[seq - 20] = true
            expect(testResult.contracts[0].fields[2]).toEqual(next2)
        }
    }, 10000)

    it("should increase executed sequence", async () => {
        const sequenceTest = await Contract.from(client, 'sequence_test.ral')
        const initFields = [40, Array(20).fill(true), Array(20).fill(true)]
        const testResult = await sequenceTest.test(client, 'check', {
            initialFields: initFields,
            address: sequenceTestAddress,
            testArgs: [81]
        })
        expect(testResult.contracts[0].fields[0]).toEqual(60)
        expect(testResult.contracts[0].fields[1]).toEqual(Array(20).fill(true))
        let next2 = Array(20).fill(false)
        next2[1] = true
        expect(testResult.contracts[0].fields[2]).toEqual(next2)
    })

    test("should fail when executed repeatedly", async () => {
        const sequenceTest = await Contract.from(client, 'sequence_test.ral')
        const initFields0 = [0, Array(20).fill(true), Array(20).fill(false)]
        for (let seq of Array(20).keys()) {
            expectAssertionFailed(async() => {
                return await sequenceTest.test(client, "check", {
                    initialFields: initFields0,
                    address: sequenceTestAddress,
                    testArgs: [seq]
                })
            })
        }

        const initFields1 = [40, Array(20).fill(false), Array(20).fill(false)]
        for (let seq of Array(40).keys()) {
            expectAssertionFailed(async() => {
                return await sequenceTest.test(client, "check", {
                    initialFields: initFields1,
                    address: sequenceTestAddress,
                    testArgs: [seq]
                })
            })
        }
    }, 10000)
})

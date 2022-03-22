import { CliqueClient, Contract } from 'alephium-js'
import { dustAmount, expectAssertionFailed, randomAddress, toContractId } from './wormhole-fixture'

describe("test sequence", () => {
    const client = new CliqueClient({baseUrl: `http://127.0.0.1:22973`})
    const sequenceTestAddress = randomAddress()
    const sequenceAddress = randomAddress()
    const executedFlag = BigInt("0xffffffffffffffffffffffffffffffff")

    it("should check sequence owner", async () => {
        const sequenceTest = await Contract.from(client, 'sequence_test.ral')
        const sequence = await Contract.from(client, 'sequence.ral')
        const owner = randomAddress()
        const contractState = sequence.toState([toContractId(owner), 0, Array(20).fill(0), Array(20).fill(0)], {alphAmount: dustAmount}, sequenceAddress)
        expectAssertionFailed(async () => {
            return await sequenceTest.test(client, "check", {
                initialFields: [true, sequenceAddress],
                address: sequenceTestAddress,
                testArgs: [0],
                existingContracts: [contractState]
            })
        })
    })

    test("should execute correctly", async () => {
        const sequenceTest = await Contract.from(client, 'sequence_test.ral')
        const sequence = await Contract.from(client, 'sequence.ral')
        const initFields = [toContractId(sequenceTestAddress), 0, Array(20).fill(0), Array(20).fill(0)]
        const contractState = sequence.toState(initFields, {alphAmount: dustAmount}, sequenceAddress)
        for (let seq of Array.from(Array(20).keys()).reverse()) {
            const testResult = await sequenceTest.test(client, 'check', {
                initialFields: [true, sequenceAddress],
                address: sequenceTestAddress,
                testArgs: [seq],
                existingContracts: [contractState]
            })
            expect(testResult.contracts[0].fields[1]).toEqual(0)
            let next1 = Array(20).fill(0)
            next1[seq] = executedFlag
            expect(testResult.contracts[0].fields[2]).toEqual(next1)
            expect(testResult.contracts[0].fields[3]).toEqual(Array(20).fill(0))
        }

        for (let seq of Array.from(Array(40).keys()).slice(20)) {
            const testResult = await sequenceTest.test(client, 'check', {
                initialFields: [true, sequenceAddress],
                address: sequenceTestAddress,
                testArgs: [seq],
                existingContracts: [contractState]
            })
            expect(testResult.contracts[0].fields[1]).toEqual(0)
            expect(testResult.contracts[0].fields[2]).toEqual(Array(20).fill(0))
            let next2 = Array(20).fill(0)
            next2[seq - 20] = executedFlag
            expect(testResult.contracts[0].fields[3]).toEqual(next2)
        }
    }, 10000)

    it("should increase executed sequence", async () => {
        const sequenceTest = await Contract.from(client, 'sequence_test.ral')
        const sequence = await Contract.from(client, 'sequence.ral')
        const initFields = [toContractId(sequenceTestAddress), 40, Array(20).fill(executedFlag), Array(20).fill(executedFlag)]
        const contractState = sequence.toState(initFields, {alphAmount: dustAmount}, sequenceAddress)
        const testResult = await sequenceTest.test(client, 'check', {
            initialFields: [true, sequenceAddress],
            address: sequenceTestAddress,
            testArgs: [81],
            existingContracts: [contractState]
        })
        expect(testResult.contracts[0].fields[1]).toEqual(60)
        expect(testResult.contracts[0].fields[2]).toEqual(Array(20).fill(executedFlag))
        let next2 = Array(20).fill(0)
        next2[1] = executedFlag
        expect(testResult.contracts[0].fields[3]).toEqual(next2)
    })

    test("should fail when executed repeatedly", async () => {
        const sequenceTest = await Contract.from(client, 'sequence_test.ral')
        const sequence = await Contract.from(client, 'sequence.ral')
        const initFields0 = [toContractId(sequenceTestAddress), 0, Array(20).fill(executedFlag), Array(20).fill(0)]
        const contractState0 = sequence.toState(initFields0, {alphAmount: dustAmount}, sequenceAddress)
        for (let seq of Array(20).keys()) {
            expectAssertionFailed(async() => {
                return await sequenceTest.test(client, "check", {
                    initialFields: [true, sequenceAddress],
                    address: sequenceTestAddress,
                    testArgs: [seq],
                    existingContracts: [contractState0]
                })
            })
        }

        const initFields1 = [toContractId(sequenceTestAddress), 40, Array(20).fill(0), Array(20).fill(0)]
        const contractState1 = sequence.toState(initFields1, {alphAmount: dustAmount}, sequenceAddress)
        for (let seq of Array(40).keys()) {
            expectAssertionFailed(async() => {
                return await sequenceTest.test(client, "check", {
                    initialFields: [true, sequenceAddress],
                    address: sequenceTestAddress,
                    testArgs: [seq],
                    existingContracts: [contractState1]
                })
            })
        }
    }, 10000)
})

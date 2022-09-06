import { Number256, setCurrentNodeProvider } from "@alephium/web3"
import { buildProject, createMath } from "./fixtures/wormhole-fixture"

describe('test math', () => {
    setCurrentNodeProvider('http://127.0.0.1:22973')

    interface TestCase {
        decimals: number
        amount: bigint
        normalizedAmount: bigint
        deNormalizedAmount: bigint
    }

    it('should test math methods', async () => {
        await buildProject()
        const mathInfo = createMath()
        const contract = mathInfo.contract

        const cases: TestCase[] = [
            {
                decimals: 6,
                amount: BigInt("100000"),
                normalizedAmount: BigInt("100000"), 
                deNormalizedAmount: BigInt("100000")
            },
            {
                decimals: 8,
                amount: BigInt("10000000"),
                normalizedAmount: BigInt("10000000"),
                deNormalizedAmount: BigInt("10000000")
            },
            {
                decimals: 10,
                amount: BigInt("10000000011"),
                normalizedAmount: BigInt("100000000"),
                deNormalizedAmount: BigInt("10000000000")
            }
        ]
        for (let tc of cases) {
            let testResult = await contract.testPublicMethod('normalizeAmount', {
                testArgs: {
                    'amount': tc.amount,
                    'decimals': tc.decimals
                }
            })
            expect(testResult.returns.length).toEqual(1)
            const normalizedAmount = testResult.returns[0] as Number256
            expect(normalizedAmount).toEqual(Number(tc.normalizedAmount))

            testResult = await contract.testPublicMethod('deNormalizeAmount', {
                testArgs: {
                    'amount': tc.normalizedAmount,
                    'decimals': tc.decimals
                }
            })
            expect(testResult.returns.length).toEqual(1)
            const deNormalizedAmount = testResult.returns[0] as Number256
            expect(deNormalizedAmount).toEqual(Number(tc.deNormalizedAmount))
        }
    })
})
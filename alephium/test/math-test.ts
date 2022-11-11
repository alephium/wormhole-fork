import { Number256, web3 } from '@alephium/web3'
import { buildProject, createMath } from './fixtures/wormhole-fixture'

describe('test math', () => {
  web3.setCurrentNodeProvider('http://127.0.0.1:22973')

  interface TestCase {
    decimals: bigint
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
        decimals: 6n,
        amount: 100000n,
        normalizedAmount: 100000n,
        deNormalizedAmount: 100000n
      },
      {
        decimals: 8n,
        amount: 10000000n,
        normalizedAmount: 10000000n,
        deNormalizedAmount: 10000000n
      },
      {
        decimals: 10n,
        amount: 10000000011n,
        normalizedAmount: 100000000n,
        deNormalizedAmount: 10000000000n
      }
    ]
    for (const tc of cases) {
      let testResult = await contract.testPublicMethod('normalizeAmount', {
        testArgs: {
          amount: tc.amount,
          decimals: tc.decimals
        }
      })
      expect(testResult.returns.length).toEqual(1)
      const normalizedAmount = testResult.returns[0] as Number256
      expect(normalizedAmount).toEqual(tc.normalizedAmount)

      testResult = await contract.testPublicMethod('deNormalizeAmount', {
        testArgs: {
          amount: tc.normalizedAmount,
          decimals: tc.decimals
        }
      })
      expect(testResult.returns.length).toEqual(1)
      const deNormalizedAmount = testResult.returns[0] as Number256
      expect(deNormalizedAmount).toEqual(tc.deNormalizedAmount)
    }
  })
})

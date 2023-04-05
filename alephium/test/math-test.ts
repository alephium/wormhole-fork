import { web3 } from '@alephium/web3'
import { buildProject } from './fixtures/wormhole-fixture'
import { MathTest } from '../artifacts/ts'

describe('test math', () => {
  web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)

  interface TestCase {
    decimals: bigint
    amount: bigint
    normalizedAmount: bigint
    deNormalizedAmount: bigint
  }

  it('should test math methods', async () => {
    await buildProject()
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
      let testResult = await MathTest.tests.normalizeAmount({
        testArgs: { amount: tc.amount, decimals: tc.decimals }
      })
      expect(testResult.returns).toEqual(tc.normalizedAmount)

      testResult = await MathTest.tests.deNormalizeAmount({
        testArgs: { amount: tc.normalizedAmount, decimals: tc.decimals }
      })
      expect(testResult.returns).toEqual(tc.deNormalizedAmount)
    }
  })
})

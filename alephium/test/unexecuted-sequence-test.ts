import { addressFromContractId, web3, InputAsset, ContractDestroyedEvent } from '@alephium/web3'
import { UnexecutedSequenceTest, UnexecutedSequenceTypes } from '../artifacts/ts'
import { createUnexecutedSequence } from './fixtures/sequence-fixture'
import {
  buildProject,
  expectAssertionFailed,
  oneAlph,
  randomAssetAddress,
  randomContractId
} from './fixtures/wormhole-fixture'

describe('test unexecuted sequence', () => {
  web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
  const allExecuted = (BigInt(1) << BigInt(256)) - 1n
  const caller = randomAssetAddress()
  const inputAsset: InputAsset[] = [{ address: caller, asset: { alphAmount: oneAlph } }]

  it('should check sequence passed', async () => {
    await buildProject()
    const parentId = randomContractId()
    const startSequence = 256n
    let sequences = 0n
    for (let seq = 0n; seq < 255n; seq++) {
      const unexecutedSequenceFixture = createUnexecutedSequence(parentId, startSequence, sequences)
      const testResult = await UnexecutedSequenceTest.tests.checkSequence({
        initialFields: { unexecutedSequenceId: unexecutedSequenceFixture.contractId },
        address: addressFromContractId(parentId),
        testArgs: { seq: seq + startSequence },
        existingContracts: unexecutedSequenceFixture.states(),
        inputAssets: inputAsset
      })
      sequences = sequences + (1n << BigInt(seq))
      const unexecutedSequence = testResult.contracts[0] as UnexecutedSequenceTypes.State
      expect(BigInt(unexecutedSequence.fields.sequences)).toEqual(sequences)
    }
  }, 50000)

  it('should check sequence failed if sequence executed', async () => {
    await buildProject()
    const parentId = randomContractId()
    const startSequence = 256n
    for (let seq = 0n; seq < 256n; seq++) {
      const sequences = 1n << BigInt(seq)
      const unexecutedSequenceFixture = createUnexecutedSequence(parentId, startSequence, sequences)
      await expectAssertionFailed(
        async () =>
          await UnexecutedSequenceTest.tests.checkSequence({
            initialFields: { unexecutedSequenceId: unexecutedSequenceFixture.contractId },
            address: addressFromContractId(parentId),
            testArgs: { seq: seq + startSequence },
            existingContracts: unexecutedSequenceFixture.states(),
            inputAssets: inputAsset
          })
      )
    }
  }, 60000)

  it('should check sequence failed if sequence is out of range', async () => {
    await buildProject()
    const parentId = randomContractId()
    const startSequence = 256n
    const sequences = [0n, startSequence - 1n, startSequence * 2n, startSequence * 10n]
    const unexecutedSequenceFixture = createUnexecutedSequence(parentId, startSequence, 0n)
    for (const seq of sequences) {
      await expectAssertionFailed(
        async () =>
          await UnexecutedSequenceTest.tests.checkSequence({
            initialFields: { unexecutedSequenceId: unexecutedSequenceFixture.contractId },
            address: addressFromContractId(parentId),
            testArgs: { seq: seq },
            existingContracts: unexecutedSequenceFixture.states(),
            inputAssets: inputAsset
          })
      )
    }
  })

  it('should destroy contract if all sequences executed', async () => {
    await buildProject()
    const parentId = randomContractId()
    const startSequence = 0n
    const unexecutedSequenceOffset = 1n
    const sequences = allExecuted - (1n << unexecutedSequenceOffset)
    const unexecutedSequenceFixture = createUnexecutedSequence(parentId, startSequence, sequences)
    const testResult = await UnexecutedSequenceTest.tests.checkSequence({
      initialFields: { unexecutedSequenceId: unexecutedSequenceFixture.contractId },
      address: addressFromContractId(parentId),
      testArgs: { seq: startSequence + unexecutedSequenceOffset },
      existingContracts: unexecutedSequenceFixture.states(),
      inputAssets: inputAsset
    })

    expect(testResult.contracts.length).toEqual(1)
    expect(testResult.contracts[0].asset).toEqual({ alphAmount: 2n * oneAlph, tokens: [] })
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0] as ContractDestroyedEvent
    expect(event.name).toEqual('ContractDestroyed')
    expect(event.fields.address).toEqual(unexecutedSequenceFixture.address)
  })

  it('should destroy contract manually', async () => {
    await buildProject()
    const parentId = randomContractId()
    const unexecutedSequenceFixture = createUnexecutedSequence(parentId, 0n, 0n)
    const testResult = await UnexecutedSequenceTest.tests.destroy({
      initialFields: { unexecutedSequenceId: unexecutedSequenceFixture.contractId },
      address: addressFromContractId(parentId),
      existingContracts: unexecutedSequenceFixture.states(),
      inputAssets: inputAsset
    })

    expect(testResult.contracts.length).toEqual(1)
    expect(testResult.contracts[0].asset).toEqual({ alphAmount: 2n * oneAlph, tokens: [] })
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0] as ContractDestroyedEvent
    expect(event.name).toEqual('ContractDestroyed')
    expect(event.fields.address).toEqual(unexecutedSequenceFixture.address)
  })

  it('should only parent contract can call these methods', async () => {
    await buildProject()
    const parentId = randomContractId()
    const unexecutedSequenceFixture = createUnexecutedSequence(randomContractId(), 0n, 0n)
    expectAssertionFailed(async () => {
      await UnexecutedSequenceTest.tests.checkSequence({
        initialFields: { unexecutedSequenceId: unexecutedSequenceFixture.contractId },
        address: addressFromContractId(parentId),
        testArgs: { seq: 1n },
        existingContracts: unexecutedSequenceFixture.states(),
        inputAssets: inputAsset
      })
    })
    expectAssertionFailed(async () => {
      await UnexecutedSequenceTest.tests.destroy({
        initialFields: { unexecutedSequenceId: unexecutedSequenceFixture.contractId },
        address: addressFromContractId(parentId),
        existingContracts: unexecutedSequenceFixture.states(),
        inputAssets: inputAsset
      })
    })
  })
})

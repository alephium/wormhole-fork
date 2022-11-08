import { Number256, addressFromContractId, Project, web3, InputAsset } from '@alephium/web3'
import { createUnexecutedSequence } from './fixtures/sequence-fixture'
import {
  buildProject,
  expectAssertionFailed,
  oneAlph,
  randomAssetAddress,
  randomContractId
} from './fixtures/wormhole-fixture'

describe('test unexecuted sequence', () => {
  web3.setCurrentNodeProvider('http://127.0.0.1:22973')
  const allExecuted = (BigInt(1) << BigInt(256)) - 1n
  const caller = randomAssetAddress()
  const inputAsset: InputAsset[] = [
    {
      address: caller,
      asset: { alphAmount: oneAlph }
    }
  ]

  it('should check sequence passed', async () => {
    await buildProject()
    const parentId = randomContractId()
    const startSequence = 256n
    const unexecutedSequenceTest = Project.contract('UnexecutedSequenceTest')
    let sequences = 0n
    for (let seq = 0n; seq < 255n; seq++) {
      const unexecutedSequenceInfo = createUnexecutedSequence(parentId, startSequence, sequences)
      const testResult = await unexecutedSequenceTest.testPublicMethod('checkSequence', {
        initialFields: { unexecutedSequenceId: unexecutedSequenceInfo.contractId },
        address: addressFromContractId(parentId),
        testArgs: { seq: seq + startSequence },
        existingContracts: unexecutedSequenceInfo.states(),
        inputAssets: inputAsset
      })
      sequences = sequences + (1n << BigInt(seq))
      const unexecutedSequence = testResult.contracts[0]
      expect(BigInt(unexecutedSequence.fields['sequences'] as Number256)).toEqual(sequences)
    }
  }, 50000)

  it('should check sequence failed if sequence executed', async () => {
    await buildProject()
    const parentId = randomContractId()
    const startSequence = 256n
    const unexecutedSequenceTest = Project.contract('UnexecutedSequenceTest')
    for (let seq = 0n; seq < 256n; seq++) {
      const sequences = 1n << BigInt(seq)
      const unexecutedSequenceInfo = createUnexecutedSequence(parentId, startSequence, sequences)
      await expectAssertionFailed(
        async () =>
          await unexecutedSequenceTest.testPublicMethod('checkSequence', {
            initialFields: { unexecutedSequenceId: unexecutedSequenceInfo.contractId },
            address: addressFromContractId(parentId),
            testArgs: { seq: seq + startSequence },
            existingContracts: unexecutedSequenceInfo.states(),
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
    const unexecutedSequenceInfo = createUnexecutedSequence(parentId, startSequence, 0n)
    const unexecutedSequenceTest = Project.contract('UnexecutedSequenceTest')
    for (const seq of sequences) {
      await expectAssertionFailed(
        async () =>
          await unexecutedSequenceTest.testPublicMethod('checkSequence', {
            initialFields: { unexecutedSequenceId: unexecutedSequenceInfo.contractId },
            address: addressFromContractId(parentId),
            testArgs: { seq: seq },
            existingContracts: unexecutedSequenceInfo.states(),
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
    const unexecutedSequenceInfo = createUnexecutedSequence(parentId, startSequence, sequences)
    const unexecutedSequenceTest = Project.contract('UnexecutedSequenceTest')
    const testResult = await unexecutedSequenceTest.testPublicMethod('checkSequence', {
      initialFields: { unexecutedSequenceId: unexecutedSequenceInfo.contractId },
      address: addressFromContractId(parentId),
      testArgs: { seq: startSequence + unexecutedSequenceOffset },
      existingContracts: unexecutedSequenceInfo.states(),
      inputAssets: inputAsset
    })

    expect(testResult.contracts.length).toEqual(1)
    expect(testResult.contracts[0].asset).toEqual({ alphAmount: 2n * oneAlph, tokens: [] })
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0]
    expect(event.name).toEqual('ContractDestroyed')
    expect(event.fields['address']).toEqual(unexecutedSequenceInfo.address)
  })

  it('should destroy contract manually', async () => {
    await buildProject()
    const parentId = randomContractId()
    const unexecutedSequenceInfo = createUnexecutedSequence(parentId, 0n, 0n)
    const unexecutedSequenceTest = Project.contract('UnexecutedSequenceTest')
    const testResult = await unexecutedSequenceTest.testPublicMethod('destroy', {
      initialFields: { unexecutedSequenceId: unexecutedSequenceInfo.contractId },
      address: addressFromContractId(parentId),
      existingContracts: unexecutedSequenceInfo.states(),
      inputAssets: inputAsset
    })

    expect(testResult.contracts.length).toEqual(1)
    expect(testResult.contracts[0].asset).toEqual({ alphAmount: 2n * oneAlph, tokens: [] })
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0]
    expect(event.name).toEqual('ContractDestroyed')
    expect(event.fields['address']).toEqual(unexecutedSequenceInfo.address)
  })

  it('should only parent contract can call these methods', async () => {
    await buildProject()
    const parentId = randomContractId()
    const unexecutedSequenceInfo = createUnexecutedSequence(randomContractId(), 0n, 0n)
    const unexecutedSequenceTest = Project.contract('UnexecutedSequenceTest')
    expectAssertionFailed(async () => {
      await unexecutedSequenceTest.testPublicMethod('checkSequence', {
        initialFields: { unexecutedSequenceId: unexecutedSequenceInfo.contractId },
        address: addressFromContractId(parentId),
        testArgs: { seq: 1n },
        existingContracts: unexecutedSequenceInfo.states(),
        inputAssets: inputAsset
      })
    })
    expectAssertionFailed(async () => {
      await unexecutedSequenceTest.testPublicMethod('destroy', {
        initialFields: { unexecutedSequenceId: unexecutedSequenceInfo.contractId },
        address: addressFromContractId(parentId),
        existingContracts: unexecutedSequenceInfo.states(),
        inputAssets: inputAsset
      })
    })
  })
})

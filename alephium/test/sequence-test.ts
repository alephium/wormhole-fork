import {
  addressFromContractId,
  web3,
  InputAsset,
  subContractId,
  ContractDestroyedEvent,
  ContractCreatedEvent
} from '@alephium/web3'
import { SequenceTest, SequenceTestTypes, UnexecutedSequenceTypes } from '../artifacts/ts'
import { createSequence, createUnexecutedSequence } from './fixtures/sequence-fixture'
import {
  buildProject,
  defaultGasFee,
  expectAssertionFailed,
  oneAlph,
  randomAssetAddress,
  randomContractId
} from './fixtures/wormhole-fixture'

describe('test sequence', () => {
  web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
  const allExecuted = (BigInt(1) << BigInt(256)) - 1n
  const caller = randomAssetAddress()
  const inputAsset: InputAsset[] = [
    {
      address: caller,
      asset: { alphAmount: oneAlph }
    }
  ]

  it('should execute correctly', async () => {
    await buildProject()
    const sequenceFixture = createSequence(0n, 0n, 0n)
    for (let seq = 0n; seq < 256n; seq++) {
      const testResult = await SequenceTest.tests.check({
        initialFields: sequenceFixture.selfState.fields,
        address: sequenceFixture.address,
        testArgs: { seq: seq },
        inputAssets: inputAsset
      })
      expect(testResult.returns).toEqual(true)
      expect(testResult.contracts.length).toEqual(1)
      const sequenceState = testResult.contracts[0] as SequenceTestTypes.State
      expect(sequenceState.fields.start).toEqual(0n)
      const firstNext256 = BigInt(1) << BigInt(seq)
      expect(sequenceState.fields.firstNext256).toEqual(firstNext256)
      expect(sequenceState.fields.secondNext256).toEqual(0n)
      expect(testResult.events.length).toEqual(0)
    }

    for (let seq = 256n; seq < 512n; seq++) {
      const testResult = await SequenceTest.tests.check({
        initialFields: sequenceFixture.selfState.fields,
        address: sequenceFixture.address,
        testArgs: { seq: seq },
        inputAssets: inputAsset
      })
      expect(testResult.returns).toEqual(true)
      expect(testResult.contracts.length).toEqual(1)
      const sequenceState = testResult.contracts[0] as SequenceTestTypes.State
      expect(sequenceState.fields.start).toEqual(0n)
      expect(sequenceState.fields.firstNext256).toEqual(0n)
      const secondNext256 = BigInt(1) << BigInt(seq - 256n)
      expect(sequenceState.fields.secondNext256).toEqual(secondNext256)
      expect(testResult.events.length).toEqual(0)
    }
  }, 90000)

  it('should increase executed sequence', async () => {
    await buildProject()
    const sequenceFixture = createSequence(512n, allExecuted, allExecuted)
    const testResult = await SequenceTest.tests.check({
      initialFields: sequenceFixture.selfState.fields,
      address: sequenceFixture.address,
      testArgs: { seq: 1025n },
      inputAssets: inputAsset
    })
    expect(testResult.returns).toEqual(true)
    expect(testResult.contracts.length).toEqual(1)
    const sequenceState = testResult.contracts[0] as SequenceTestTypes.State
    expect(sequenceState.fields.start).toEqual(512n + 256n)
    expect(sequenceState.fields.firstNext256).toEqual(allExecuted)
    expect(sequenceState.fields.secondNext256).toEqual(2n)
    expect(testResult.events.length).toEqual(0)
  })

  it('should check sequence failed and create unexecuted sequence subcontract', async () => {
    await buildProject()
    const sequenceFixture = createSequence(0n, 1n, 1n)
    const testResult = await SequenceTest.tests.check({
      initialFields: sequenceFixture.selfState.fields,
      initialAsset: { alphAmount: oneAlph * 2n },
      address: sequenceFixture.address,
      testArgs: { seq: 768n },
      inputAssets: inputAsset,
      existingContracts: sequenceFixture.dependencies
    })
    expect(testResult.returns).toEqual(false)
    const sequenceContractState = testResult.contracts[2] as SequenceTestTypes.State
    expect(sequenceContractState.fields.start).toEqual(256n)
    expect(sequenceContractState.fields.firstNext256).toEqual(1n)
    expect(sequenceContractState.fields.secondNext256).toEqual(0n)

    const unexecutedSequenceContractState = testResult.contracts[0] as UnexecutedSequenceTypes.State
    expect(unexecutedSequenceContractState.fields.begin).toEqual(0n)
    expect(unexecutedSequenceContractState.fields.sequences).toEqual(1n)

    const sequenceOutput = testResult.txOutputs[1]
    expect(sequenceOutput.alphAmount).toEqual(oneAlph)
    const unexecutedSequenceOutput = testResult.txOutputs[0]
    expect(unexecutedSequenceOutput.address).toEqual(
      addressFromContractId(subContractId(sequenceFixture.contractId, '0000000000000000', 0))
    )
  })

  it('should failed when executed repeatedly', async () => {
    await buildProject()
    const unexecutedSequenceTemplateId = randomContractId()
    const sequenceFixture = createSequence(0n, allExecuted, 0n)
    for (let seq = 0n; seq < 256n; seq++) {
      await expectAssertionFailed(async () => {
        return await SequenceTest.tests.check({
          initialFields: sequenceFixture.selfState.fields,
          address: sequenceFixture.address,
          testArgs: { seq: seq },
          existingContracts: sequenceFixture.dependencies,
          inputAssets: inputAsset
        })
      })
    }

    for (let seq = 256n; seq < 512n; seq++) {
      await expectAssertionFailed(async () => {
        return await SequenceTest.tests.check({
          initialFields: {
            start: 0n,
            firstNext256: 0n,
            secondNext256: allExecuted,
            unexecutedSequenceTemplateId: unexecutedSequenceTemplateId
          },
          address: sequenceFixture.address,
          testArgs: { seq: seq },
          existingContracts: sequenceFixture.dependencies,
          inputAssets: inputAsset
        })
      })
    }
  }, 120000)

  it('should check sequence succeed and create unexecuted sequence subcontract', async () => {
    await buildProject()
    const start = 256n
    const firstNext256 = BigInt(0xff) << 248n
    const sequenceFixture = createSequence(start, firstNext256, 0n)
    const testResult = await SequenceTest.tests.check({
      initialFields: sequenceFixture.selfState.fields,
      initialAsset: { alphAmount: oneAlph * 2n },
      address: sequenceFixture.address,
      testArgs: { seq: start + 513n },
      existingContracts: sequenceFixture.dependencies,
      inputAssets: inputAsset
    })
    expect(testResult.returns).toEqual(true)
    const sequenceContractState = testResult.contracts[2] as SequenceTestTypes.State
    expect(sequenceContractState.fields.start).toEqual(start + 256n)
    expect(sequenceContractState.fields.firstNext256).toEqual(0n)
    expect(sequenceContractState.fields.secondNext256).toEqual(2n)
    expect(sequenceContractState.asset).toEqual({ alphAmount: oneAlph, tokens: [] })

    const subContractOutput = testResult.contracts[0] as UnexecutedSequenceTypes.State
    expect(subContractOutput.fields.begin).toEqual(256n)
    expect(subContractOutput.fields.sequences).toEqual(firstNext256)
    const expectedContractId = subContractId(sequenceFixture.contractId, '0000000000000001', 0)
    expect(subContractOutput.contractId).toEqual(expectedContractId)
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0] as ContractCreatedEvent
    expect(event.fields.address).toEqual(addressFromContractId(expectedContractId))
  })

  it('should mark old sequence as done', async () => {
    await buildProject()
    const parentId = randomContractId()
    const sequenceFixture = createSequence(512n, 0n, 0n, parentId)
    const unexecutedSequenceContractId = subContractId(parentId, '0000000000000001', 0)
    const sequences = allExecuted - 0xffn
    const unexecutedSequenceFixture = createUnexecutedSequence(parentId, 256n, sequences, unexecutedSequenceContractId)
    for (let seq = 0n; seq < 8n; seq++) {
      const testResult = await SequenceTest.tests.check({
        initialFields: sequenceFixture.selfState.fields,
        initialAsset: { alphAmount: oneAlph * 10n },
        address: sequenceFixture.address,
        testArgs: { seq: 256n + seq },
        existingContracts: Array.prototype.concat(sequenceFixture.dependencies, unexecutedSequenceFixture.states()),
        inputAssets: inputAsset
      })
      expect(testResult.returns).toEqual(true)
      const unexecutedSequenceState = testResult.contracts[1] as UnexecutedSequenceTypes.State
      expect(unexecutedSequenceState.fields.sequences).toEqual(sequences + (1n << BigInt(seq)))
      const sequenceState = testResult.contracts[2] as SequenceTestTypes.State
      expect(sequenceState.fields.start).toEqual(512n)
      expect(sequenceState.fields.firstNext256).toEqual(0n)
      expect(sequenceState.fields.secondNext256).toEqual(0n)
      expect(testResult.events.length).toEqual(0)
    }
  })

  it('should failed if old sequences executed', async () => {
    await buildProject()
    const parentId = randomContractId()
    const sequenceInfo = createSequence(512n, 0n, 0n, parentId)
    const unexecutedSequenceContractId = subContractId(parentId, '0000000000000001', 0)
    const sequences = allExecuted - 1n
    const unexecutedSequenceInfo = createUnexecutedSequence(parentId, 256n, sequences, unexecutedSequenceContractId)
    for (let seq = 1n; seq < 256n; seq++) {
      await expectAssertionFailed(async () => {
        await SequenceTest.tests.check({
          initialFields: sequenceInfo.selfState.fields,
          initialAsset: { alphAmount: oneAlph * 10n },
          address: sequenceInfo.address,
          testArgs: { seq: 256n + seq },
          existingContracts: Array.prototype.concat(sequenceInfo.dependencies, unexecutedSequenceInfo.states()),
          inputAssets: inputAsset
        })
      })
    }
  }, 60000)

  it('should destroy sub contract if all old sequence executed', async () => {
    await buildProject()
    const parentId = randomContractId()
    const sequenceFixture = createSequence(512n, 0n, 0n, parentId)
    const unexecutedSequenceFixture = subContractId(parentId, '0000000000000001', 0)
    const sequences = allExecuted - 1n
    const unexecutedSequenceInfo = createUnexecutedSequence(parentId, 256n, sequences, unexecutedSequenceFixture)
    const testResult = await SequenceTest.tests.check({
      initialFields: sequenceFixture.selfState.fields,
      initialAsset: { alphAmount: oneAlph },
      address: sequenceFixture.address,
      testArgs: { seq: 256n },
      existingContracts: Array.prototype.concat(sequenceFixture.dependencies, unexecutedSequenceInfo.states()),
      inputAssets: inputAsset
    })
    expect(testResult.returns).toEqual(true)
    expect(testResult.contracts.map((c) => c.address).includes(unexecutedSequenceInfo.address)).toEqual(false)
    expect(testResult.events.length).toEqual(1)

    const sequenceContractAssets = testResult.txOutputs.find((o) => o.address === sequenceFixture.address)!
    expect(sequenceContractAssets.alphAmount).toEqual(oneAlph * 2n)
    const destroyEvent = testResult.events[0] as ContractDestroyedEvent
    expect(destroyEvent.name).toEqual('ContractDestroyed')
    expect(destroyEvent.fields.address).toEqual(unexecutedSequenceInfo.address)
    const assetOutput = testResult.txOutputs[1]
    expect(assetOutput.alphAmount).toEqual(oneAlph - defaultGasFee)
  })
})

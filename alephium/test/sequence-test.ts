import { addressFromContractId, web3, InputAsset, subContractId } from '@alephium/web3'
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
  web3.setCurrentNodeProvider('http://127.0.0.1:22973')
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
    const sequenceInfo = createSequence(0n, 0n, 0n)
    const sequence = sequenceInfo.contract
    for (let seq = 0n; seq < 256n; seq++) {
      const testResult = await sequence.testPublicMethod('check', {
        initialFields: sequenceInfo.selfState.fields,
        address: sequenceInfo.address,
        testArgs: { seq: seq },
        inputAssets: inputAsset
      })
      expect(testResult.returns).toEqual([true])
      expect(testResult.contracts.length).toEqual(1)
      expect(testResult.contracts[0].fields['start']).toEqual(0n)
      const firstNext256 = BigInt(1) << BigInt(seq)
      expect(testResult.contracts[0].fields['firstNext256']).toEqual(firstNext256)
      expect(testResult.contracts[0].fields['secondNext256']).toEqual(0n)
      expect(testResult.events.length).toEqual(0)
    }

    for (let seq = 256n; seq < 512n; seq++) {
      const testResult = await sequence.testPublicMethod('check', {
        initialFields: sequenceInfo.selfState.fields,
        address: sequenceInfo.address,
        testArgs: { seq: seq },
        inputAssets: inputAsset
      })
      expect(testResult.returns).toEqual([true])
      expect(testResult.contracts.length).toEqual(1)
      expect(testResult.contracts[0].fields['start']).toEqual(0n)
      expect(testResult.contracts[0].fields['firstNext256']).toEqual(0n)
      const secondNext256 = BigInt(1) << BigInt(seq - 256n)
      expect(testResult.contracts[0].fields['secondNext256']).toEqual(secondNext256)
      expect(testResult.events.length).toEqual(0)
    }
  }, 90000)

  it('should increase executed sequence', async () => {
    await buildProject()
    const sequenceInfo = createSequence(512n, allExecuted, allExecuted)
    const sequence = sequenceInfo.contract
    const testResult = await sequence.testPublicMethod('check', {
      initialFields: sequenceInfo.selfState.fields,
      address: sequenceInfo.address,
      testArgs: { seq: 1025n },
      inputAssets: inputAsset
    })
    expect(testResult.returns).toEqual([true])
    expect(testResult.contracts.length).toEqual(1)
    expect(testResult.contracts[0].fields['start']).toEqual(512n + 256n)
    expect(testResult.contracts[0].fields['firstNext256']).toEqual(allExecuted)
    expect(testResult.contracts[0].fields['secondNext256']).toEqual(2n)
    expect(testResult.events.length).toEqual(0)
  })

  it('should check sequence failed and create unexecuted sequence subcontract', async () => {
    await buildProject()
    const sequenceInfo = createSequence(0n, 1n, 1n)
    const sequence = sequenceInfo.contract
    const testResult = await sequence.testPublicMethod('check', {
      initialFields: sequenceInfo.selfState.fields,
      initialAsset: { alphAmount: oneAlph * 2n },
      address: sequenceInfo.address,
      testArgs: { seq: 768n },
      inputAssets: inputAsset,
      existingContracts: sequenceInfo.dependencies
    })
    expect(testResult.returns).toEqual([false])
    const sequenceContractState = testResult.contracts[2]
    expect(sequenceContractState.fields['start']).toEqual(256n)
    expect(sequenceContractState.fields['firstNext256']).toEqual(1n)
    expect(sequenceContractState.fields['secondNext256']).toEqual(0n)

    const unexecutedSequenceContractState = testResult.contracts[0]
    expect(unexecutedSequenceContractState.fields['begin']).toEqual(0n)
    expect(unexecutedSequenceContractState.fields['sequences']).toEqual(1n)

    const sequenceOutput = testResult.txOutputs[1]
    expect(sequenceOutput.alphAmount).toEqual(oneAlph)
    const unexecutedSequenceOutput = testResult.txOutputs[0]
    expect(unexecutedSequenceOutput.address).toEqual(
      addressFromContractId(subContractId(sequenceInfo.contractId, '0000000000000000', 0))
    )
  })

  it('should failed when executed repeatedly', async () => {
    await buildProject()
    const unexecutedSequenceTemplateId = randomContractId()
    const sequenceInfo = createSequence(0n, allExecuted, 0n)
    const sequence = sequenceInfo.contract
    for (let seq = 0n; seq < 256n; seq++) {
      await expectAssertionFailed(async () => {
        return await sequence.testPublicMethod('check', {
          initialFields: sequenceInfo.selfState.fields,
          address: sequenceInfo.address,
          testArgs: { seq: seq },
          existingContracts: sequenceInfo.dependencies,
          inputAssets: inputAsset
        })
      })
    }

    for (let seq = 256n; seq < 512n; seq++) {
      await expectAssertionFailed(async () => {
        return await sequence.testPublicMethod('check', {
          initialFields: {
            start: 0n,
            firstNext256: 0n,
            secondNext256: allExecuted,
            unexecutedSequenceTemplateId: unexecutedSequenceTemplateId
          },
          address: sequenceInfo.address,
          testArgs: { seq: seq },
          existingContracts: sequenceInfo.dependencies,
          inputAssets: inputAsset
        })
      })
    }
  }, 120000)

  it('should check sequence succeed and create unexecuted sequence subcontract', async () => {
    await buildProject()
    const start = 256n
    const firstNext256 = BigInt(0xff) << 248n
    const sequenceInfo = createSequence(start, firstNext256, 0n)
    const sequence = sequenceInfo.contract
    const testResult = await sequence.testPublicMethod('check', {
      initialFields: sequenceInfo.selfState.fields,
      initialAsset: { alphAmount: oneAlph * 2n },
      address: sequenceInfo.address,
      testArgs: { seq: start + 513n },
      existingContracts: sequenceInfo.dependencies,
      inputAssets: inputAsset
    })
    expect(testResult.returns).toEqual([true])
    const sequenceContractState = testResult.contracts[2]
    expect(sequenceContractState.fields['start']).toEqual(start + 256n)
    expect(sequenceContractState.fields['firstNext256']).toEqual(0n)
    expect(sequenceContractState.fields['secondNext256']).toEqual(2n)
    expect(sequenceContractState.asset).toEqual({ alphAmount: oneAlph, tokens: [] })

    const subContractOutput = testResult.contracts[0]
    expect(subContractOutput.fields['begin']).toEqual(256n)
    expect(subContractOutput.fields['sequences']).toEqual(firstNext256)
    const expectedContractId = subContractId(sequenceInfo.contractId, '0000000000000001', 0)
    expect(subContractOutput.contractId).toEqual(expectedContractId)
    expect(testResult.events.length).toEqual(1)
  })

  it('should mark old sequence as done', async () => {
    await buildProject()
    const parentId = randomContractId()
    const sequenceInfo = createSequence(512n, 0n, 0n, parentId)
    const unexecutedSequenceContractId = subContractId(parentId, '0000000000000001', 0)
    const sequences = allExecuted - 0xffn
    const unexecutedSequenceInfo = createUnexecutedSequence(parentId, 256n, sequences, unexecutedSequenceContractId)
    const sequence = sequenceInfo.contract
    for (let seq = 0n; seq < 8n; seq++) {
      const testResult = await sequence.testPublicMethod('check', {
        initialFields: sequenceInfo.selfState.fields,
        initialAsset: { alphAmount: oneAlph * 10n },
        address: sequenceInfo.address,
        testArgs: { seq: 256n + seq },
        existingContracts: Array.prototype.concat(sequenceInfo.dependencies, unexecutedSequenceInfo.states()),
        inputAssets: inputAsset
      })
      expect(testResult.returns).toEqual([true])
      const unexecutedSequenceContract = testResult.contracts[1]
      expect(unexecutedSequenceContract.fields['sequences']).toEqual(sequences + (1n << BigInt(seq)))
      expect(testResult.contracts[2].fields['start']).toEqual(512n)
      expect(testResult.contracts[2].fields['firstNext256']).toEqual(0n)
      expect(testResult.contracts[2].fields['secondNext256']).toEqual(0n)
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
    const sequence = sequenceInfo.contract
    for (let seq = 1n; seq < 256n; seq++) {
      await expectAssertionFailed(async () => {
        await sequence.testPublicMethod('check', {
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
    const sequenceInfo = createSequence(512n, 0n, 0n, parentId)
    const unexecutedSequenceContractId = subContractId(parentId, '0000000000000001', 0)
    const sequences = allExecuted - 1n
    const unexecutedSequenceInfo = createUnexecutedSequence(parentId, 256n, sequences, unexecutedSequenceContractId)
    const sequence = sequenceInfo.contract
    const testResult = await sequence.testPublicMethod('check', {
      initialFields: sequenceInfo.selfState.fields,
      initialAsset: { alphAmount: oneAlph },
      address: sequenceInfo.address,
      testArgs: { seq: 256n },
      existingContracts: Array.prototype.concat(sequenceInfo.dependencies, unexecutedSequenceInfo.states()),
      inputAssets: inputAsset
    })
    expect(testResult.returns).toEqual([true])
    expect(testResult.contracts.map((c) => c.address).includes(unexecutedSequenceInfo.address)).toEqual(false)
    expect(testResult.events.length).toEqual(1)

    const sequenceContractAssets = testResult.txOutputs.find((o) => o.address === sequenceInfo.address)!
    expect(sequenceContractAssets.alphAmount).toEqual(oneAlph * 2n)
    const destroyEvent = testResult.events[0]
    expect(destroyEvent.name).toEqual('ContractDestroyed')
    expect(destroyEvent.fields['address']).toEqual(unexecutedSequenceInfo.address)
    const assetOutput = testResult.txOutputs[1]
    expect(assetOutput.alphAmount).toEqual(oneAlph - defaultGasFee)
  })
})

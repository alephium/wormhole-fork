import { addressFromContractId } from '@alephium/web3'
import { ContractFixture, randomContractAddress, randomContractId } from './wormhole-fixture'
import { UnexecutedSequence, SequenceTest } from '../../artifacts/ts'

export function createUnexecutedSequence(parentId: string, begin: bigint, sequences: bigint, contractId?: string) {
  const address = typeof contractId === 'undefined' ? randomContractAddress() : addressFromContractId(contractId)
  const initFields = {
    parentId: parentId,
    begin: begin,
    sequences: sequences
  }
  const state = UnexecutedSequence.stateForTest(initFields, undefined, address)
  return new ContractFixture(state, [])
}

export function createSequence(start: bigint, firstNext256: bigint, secondNext256: bigint, contractId?: string) {
  const address = typeof contractId === 'undefined' ? randomContractAddress() : addressFromContractId(contractId)
  const unexecutedSequenceTemplate = createUnexecutedSequence(randomContractId(), 0n, 0n)
  const initField = {
    start: start,
    firstNext256: firstNext256,
    secondNext256: secondNext256,
    unexecutedSequenceTemplateId: unexecutedSequenceTemplate.contractId
  }
  const state = SequenceTest.stateForTest(initField, undefined, address)
  return new ContractFixture(state, unexecutedSequenceTemplate.states())
}

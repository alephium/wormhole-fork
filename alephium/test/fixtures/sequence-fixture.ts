import { Project, addressFromContractId } from '@alephium/web3'
import { ContractInfo, initAsset, randomContractAddress, randomContractId } from './wormhole-fixture'

export function createUnexecutedSequence(
  parentId: string,
  begin: bigint,
  sequences: bigint,
  contractId?: string
): ContractInfo {
  const contract = Project.contract('UnexecutedSequence')
  const address = typeof contractId === 'undefined' ? randomContractAddress() : addressFromContractId(contractId)
  const initFields = {
    parentId: parentId,
    begin: begin,
    sequences: sequences
  }
  const state = contract.toState(initFields, initAsset, address)
  return new ContractInfo(contract, state, [], address)
}

export function createSequence(
  start: bigint,
  firstNext256: bigint,
  secondNext256: bigint,
  contractId?: string
): ContractInfo {
  const address = typeof contractId === 'undefined' ? randomContractAddress() : addressFromContractId(contractId)
  const unexecutedSequenceTemplate = createUnexecutedSequence(randomContractId(), 0n, 0n)
  const contract = Project.contract('SequenceTest')
  const initField = {
    start: start,
    firstNext256: firstNext256,
    secondNext256: secondNext256,
    unexecutedSequenceTemplateId: unexecutedSequenceTemplate.contractId
  }
  const state = contract.toState(initField, initAsset, address)
  return new ContractInfo(contract, state, unexecutedSequenceTemplate.states(), address)
}

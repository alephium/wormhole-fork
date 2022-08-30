import { Project, addressFromContractId } from "@alephium/web3";
import { ContractInfo, initAsset, randomAssetAddress, randomContractAddress, randomContractId } from "./wormhole-fixture";

export function createUnExecutedSequence(
    parentId: string,
    begin: number,
    sequences: bigint,
    refundAddress: string,
    contractId?: string
): ContractInfo {
    const contract = Project.contract('sequence/unexecuted_sequence.ral')
    const address = typeof contractId === 'undefined' ? randomContractAddress() : addressFromContractId(contractId)
    const initFields = {
        "parentId": parentId,
        "begin": begin,
        "sequences": sequences,
        "refundAddress": refundAddress
    }
    const state = contract.toState(initFields, initAsset, address)
    return new ContractInfo(contract, state, [], address)
}

export function createSequence(
    next: number,
    next1: bigint,
    next2: bigint,
    refundAddress: string,
    contractId?: string
): ContractInfo {
    const address = typeof contractId === 'undefined' ? randomContractAddress() : addressFromContractId(contractId)
    const unExecutedSequenceTemplate = createUnExecutedSequence(
        randomContractId(), 0, 0n, randomAssetAddress()
    )
    const contract = Project.contract('tests/sequence_test.ral', {errorOnWarnings: false})
    const initField = {
        'next': next,
        'next1': next1,
        'next2': next2,
        'unExecutedSequenceTemplateId': unExecutedSequenceTemplate.contractId,
        'refundAddress': refundAddress
    }
    const state = contract.toState(initField, initAsset, address)
    return new ContractInfo(contract, state, unExecutedSequenceTemplate.states(), address)
}

import { Project, addressFromContractId } from "@alephium/web3";
import { ContractInfo, initAsset, randomAssetAddress, randomContractAddress, randomContractId } from "./wormhole-fixture";

export function createUnexecutedSequence(
    parentId: string,
    begin: number,
    sequences: bigint,
    refundAddress: string,
    contractId?: string
): ContractInfo {
    const contract = Project.contract('UnexecutedSequence')
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
    start: number,
    firstNext256: bigint,
    secondNext256: bigint,
    refundAddress: string,
    contractId?: string
): ContractInfo {
    const address = typeof contractId === 'undefined' ? randomContractAddress() : addressFromContractId(contractId)
    const unexecutedSequenceTemplate = createUnexecutedSequence(
        randomContractId(), 0, 0n, randomAssetAddress()
    )
    const contract = Project.contract('SequenceTest')
    const initField = {
        'start': start,
        'firstNext256': firstNext256,
        'secondNext256': secondNext256,
        'unexecutedSequenceTemplateId': unexecutedSequenceTemplate.contractId,
        'refundAddress': refundAddress
    }
    const state = contract.toState(initField, initAsset, address)
    return new ContractInfo(contract, state, unexecutedSequenceTemplate.states(), address)
}

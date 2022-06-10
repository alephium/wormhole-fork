import { NodeProvider, Contract } from "@alephium/web3";
import { ContractInfo, initAsset, randomContractAddress } from "./wormhole-fixture";

export async function createUndoneSequence(
    provider: NodeProvider,
    owner: string,
    undoneSequenceList: string = "",
    undoneSequenceMaxSize: number = 256,
    undoneSequenceMaxDistance: number = 256
): Promise<ContractInfo> {
    const contract = await Contract.fromSource(provider, 'undone_sequence.ral')
    const address = randomContractAddress()
    const initFields = {
        "owner": owner,
        "undone": undoneSequenceList,
        "undoneSequenceMaxSize": undoneSequenceMaxSize,
        "undoneSequenceMaxDistance": undoneSequenceMaxDistance
    }
    const state = contract.toState(initFields, initAsset, address)
    return new ContractInfo(contract, state, [], address)
}

export async function createSequence(
    provider: NodeProvider,
    eventEmitter: ContractInfo,
    next: number,
    next1: bigint,
    next2: bigint,
    undoneSequenceList: string = "",
    undoneSequenceMaxSize: number = 256,
    undoneSequenceMaxDistance: number = 256
): Promise<ContractInfo> {
    const address = randomContractAddress()
    const undoneSequence = await createUndoneSequence(
        provider,
        address,
        undoneSequenceList,
        undoneSequenceMaxSize,
        undoneSequenceMaxDistance
    )
    const contract = await Contract.fromSource(provider, 'sequence.ral')
    const initField = {
        'next': next,
        'next1': next1,
        'next2': next2,
        'undoneSequenceId': undoneSequence.contractId,
        'undoneSequenceCodeHash': undoneSequence.codeHash,
        'eventEmitterId': eventEmitter.contractId
    }
    const state = contract.toState(initField, initAsset, address)
    return new ContractInfo(
        contract,
        state,
        [undoneSequence.selfState, eventEmitter.selfState],
        address
    )
}

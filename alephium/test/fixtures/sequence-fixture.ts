import { CliqueClient, Contract } from "alephium-web3";
import { ContractInfo, dustAmount, randomContractAddress } from "./wormhole-fixture";

export async function createUndoneSequence(
    client: CliqueClient,
    owner: string,
    undoneSequenceList: string = "",
    undoneSequenceMaxSize: number = 256,
    undoneSequenceMaxDistance: number = 256
): Promise<ContractInfo> {
    const contract = await Contract.fromSource(client, 'undone_sequence.ral')
    const address = randomContractAddress()
    const templateVariables = {
        undoneSequenceMaxSize: undoneSequenceMaxSize,
        undoneSequenceMaxDistance: undoneSequenceMaxDistance
    }
    const state = contract.toState([owner, undoneSequenceList], {alphAmount: dustAmount}, address, templateVariables)
    return new ContractInfo(contract, state, [], address, templateVariables)
}

export async function createSequence(
    client: CliqueClient,
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
        client,
        address,
        undoneSequenceList,
        undoneSequenceMaxSize,
        undoneSequenceMaxDistance
    )
    const contract = await Contract.fromSource(client, 'sequence.ral')
    const templateVariables = {
        undoneSequenceCodeHash: undoneSequence.codeHash,
        eventEmitterId: eventEmitter.selfState.contractId
    }
    const state = contract.toState(
        [next, next1, next2, undoneSequence.address],
        {alphAmount: dustAmount},
        address,
        templateVariables
    )
    return new ContractInfo(
        contract,
        state,
        [undoneSequence.selfState, eventEmitter.selfState],
        address,
        templateVariables
    )
}

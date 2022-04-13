import { CliqueClient, Contract } from "alephium-web3";
import { ContractInfo, dustAmount, randomContractAddress } from "./wormhole-fixture";

export async function undoneSequenceContract(
    client: CliqueClient,
    undoneSequenceMaxSize: number = 256,
    undoneSequenceMaxDistance: number = 256
): Promise<Contract> {
    return await Contract.from(client, 'undone_sequence.ral', {
        undoneSequenceMaxSize: undoneSequenceMaxSize,
        undoneSequenceMaxDistance: undoneSequenceMaxDistance
    })
}

export async function createUndoneSequence(
    client: CliqueClient,
    owner: string,
    undoneSequenceList: string = "",
    undoneSequenceMaxSize: number = 256,
    undoneSequenceMaxDistance: number = 256
): Promise<ContractInfo> {
    const contract = await Contract.from(client, 'undone_sequence.ral', {
        undoneSequenceMaxSize: undoneSequenceMaxSize,
        undoneSequenceMaxDistance: undoneSequenceMaxDistance
    })
    const address = randomContractAddress()
    const state = contract.toState([owner, undoneSequenceList], {alphAmount: dustAmount}, address)
    return new ContractInfo(contract, state, [], address)
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
    const undoneSequence = await createUndoneSequence(client, address, undoneSequenceList, undoneSequenceMaxSize, undoneSequenceMaxDistance)
    const contract = await Contract.from(client, 'sequence.ral', {
        eventEmitterId: eventEmitter.address,
        undoneSequenceCodeHash: undoneSequence.contract.codeHash,
        undoneSequenceMaxSize: undoneSequenceMaxSize,
        undoneSequenceMaxDistance: undoneSequenceMaxDistance
    })
    const state = contract.toState([next, next1, next2, undoneSequence.address], {alphAmount: dustAmount}, address)
    return new ContractInfo(contract, state, [undoneSequence.selfState, eventEmitter.selfState], address)
}

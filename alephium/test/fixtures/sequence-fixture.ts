import { CliqueClient, Contract } from "alephium-web3";
import { ContractInfo, dustAmount, randomContractAddress } from "./wormhole-fixture";

export async function undoneSequenceContract(
    client: CliqueClient,
    listMaxSize: number = 256,
    distance: number = 256
): Promise<Contract> {
    return await Contract.from(client, 'undone_sequence.ral', {
        listMaxSize: listMaxSize,
        distance: distance
    })
}

export async function createUndoneSequence(
    client: CliqueClient,
    owner: string,
    undoneSequenceList: string = "",
    listMaxSize: number = 256,
    distance: number = 256
): Promise<ContractInfo> {
    const contract = await Contract.from(client, 'undone_sequence.ral', {
        listMaxSize: listMaxSize,
        distance: distance
    })
    const address = randomContractAddress()
    const state = contract.toState([owner, undoneSequenceList], {alphAmount: dustAmount}, address)
    return new ContractInfo(contract, state, [], address)
}

export async function createSequence(
    client: CliqueClient,
    next: number,
    next1: bigint,
    next2: bigint,
    undoneSequenceList: string = "",
    listMaxSize: number = 32,
    distance: number = 32
): Promise<ContractInfo> {
    const address = randomContractAddress()
    const undoneSequence = await createUndoneSequence(client, address, undoneSequenceList, listMaxSize, distance)
    const contract = await Contract.from(client, 'sequence.ral', {
        undoneSequenceCodeHash: undoneSequence.contract.codeHash,
        listMaxSize: listMaxSize,
        distance: distance
    })
    const state = contract.toState([next, next1, next2, undoneSequence.address], {alphAmount: dustAmount}, address)
    return new ContractInfo(contract, state, undoneSequence.states(), address)
}

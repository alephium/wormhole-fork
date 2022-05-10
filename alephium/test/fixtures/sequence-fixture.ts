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
    const state = contract.toState(
        [owner, undoneSequenceList, undoneSequenceMaxSize, undoneSequenceMaxDistance],
        {alphAmount: dustAmount},
        address
    )
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
    const undoneSequence = await createUndoneSequence(
        client,
        address,
        undoneSequenceList,
        undoneSequenceMaxSize,
        undoneSequenceMaxDistance
    )
    const contract = await Contract.fromSource(client, 'sequence.ral')
    const state = contract.toState(
        [next, next1, next2, undoneSequence.contractId, undoneSequence.codeHash, eventEmitter.contractId],
        {alphAmount: dustAmount},
        address
    )
    return new ContractInfo(
        contract,
        state,
        [undoneSequence.selfState, eventEmitter.selfState],
        address
    )
}

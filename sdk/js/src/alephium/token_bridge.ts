import { Script } from 'alephium-web3'

const artifactsPath = "./artifacts"

export async function createLocalTokenWrapperScript(): Promise<Script> {
    return Script.fromArtifactFile(`${artifactsPath}/create_local_wrapper.ral.json`)
}

export async function createRemoteTokenWrapperScript(): Promise<Script> {
    return Script.fromArtifactFile(`${artifactsPath}/create_remote_wrapper.ral.json`)
}

export async function transferLocalTokenScript(): Promise<Script> {
    return Script.fromArtifactFile(`${artifactsPath}/transfer_local.ral.json`)
}

export async function transferRemoteTokenScript(): Promise<Script> {
    return Script.fromArtifactFile(`${artifactsPath}/transfer_remote.ral.json`)
}

export async function completeTransferScript(): Promise<Script> {
    return Script.fromArtifactFile(`${artifactsPath}/complete_transfer.ral.json`)
}

export async function attestTokenScript(): Promise<Script> {
    return Script.fromArtifactFile(`${artifactsPath}/attest_token.ral.json`)
}

export async function completeUndoneSequenceScript(): Promise<Script> {
    return Script.fromArtifactFile(`${artifactsPath}/complete_undone_sequence.ral.json`)
}

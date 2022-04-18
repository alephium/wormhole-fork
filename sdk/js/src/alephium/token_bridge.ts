import { Script } from 'alephium-web3'
import { promises } from 'fs'

const artifactsPath = `${__dirname}/artifacts`

async function readJson(file: string) {
    const content = await promises.readFile(file)
    return JSON.parse(content.toString())
}

export async function createLocalTokenWrapperScript(): Promise<Script> {
    const json = await readJson(`${artifactsPath}/create_local_wrapper.ral.json`)
    return Script.fromJson(json)
}

export async function createRemoteTokenWrapperScript(): Promise<Script> {
    const json = await readJson(`${artifactsPath}/create_remote_wrapper.ral.json`)
    return Script.fromJson(json)
}

export async function transferLocalTokenScript(): Promise<Script> {
    const json = await readJson(`${artifactsPath}/transfer_local.ral.json`)
    return Script.fromJson(json)
}

export async function transferRemoteTokenScript(): Promise<Script> {
    const json = await readJson(`${artifactsPath}/transfer_remote.ral.json`)
    return Script.fromJson(json)
}

export async function completeTransferScript(): Promise<Script> {
    const json = await readJson(`${artifactsPath}/complete_transfer.ral.json`)
    return Script.fromJson(json)
}

export async function attestTokenScript(): Promise<Script> {
    const json = await readJson(`${artifactsPath}/attest_token.ral.json`)
    return Script.fromJson(json)
}

export async function completeUndoneSequenceScript(): Promise<Script> {
    const json = await readJson(`${artifactsPath}/complete_undone_sequence.ral.json`)
    return Script.fromJson(json)
}

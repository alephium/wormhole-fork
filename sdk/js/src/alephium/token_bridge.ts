import { Script } from '@alephium/web3'
import { default as createLocalTokenPool } from './artifacts/create_local_token_pool.ral.json'
import { default as createRemoteTokenPool } from './artifacts/create_remote_token_pool.ral.json'
import { default as createWrappedAlphPool } from './artifacts/create_wrapped_alph_pool.ral.json'
import { default as transferAlph } from './artifacts/transfer_alph.ral.json'
import { default as transferLocalToken } from './artifacts/transfer_local.ral.json'
import { default as transferRemoteToken } from './artifacts/transfer_remote.ral.json'
import { default as completeTransfer } from './artifacts/complete_transfer.ral.json'
import { default as attestToken } from './artifacts/attest_token.ral.json'
import { default as attestWrappedAlph } from './artifacts/attest_wrapped_alph.ral.json'
import { default as destroyUnExecutedSequences } from './artifacts/destroy_unexecuted_sequence_contracts.ral.json'

export function createLocalTokenPoolScript(): Script {
    return Script.fromJson(createLocalTokenPool)
}

export function createRemoteTokenPoolScript(): Script {
    return Script.fromJson(createRemoteTokenPool)
}

export function createWrappedAlphPoolScript(): Script {
    return Script.fromJson(createWrappedAlphPool)
}

export function transferLocalTokenScript(): Script {
    return Script.fromJson(transferLocalToken)
}

export function transferRemoteTokenScript(): Script {
    return Script.fromJson(transferRemoteToken)
}

export function transferAlphScript(): Script {
    return Script.fromJson(transferAlph)
}

export function completeTransferScript(): Script {
    return Script.fromJson(completeTransfer)
}

export function attestTokenScript(): Script {
    return Script.fromJson(attestToken)
}

export function attestWrappedAlphScript(): Script {
    return Script.fromJson(attestWrappedAlph)
}

export function destroyUnExecutedSequencesScript(): Script {
    return Script.fromJson(destroyUnExecutedSequences)
}

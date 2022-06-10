import { Script } from '@alephium/web3'
import { default as createLocalTokenWrapper } from './artifacts/create_local_wrapper.ral.json'
import { default as createRemoteTokenWrapper } from './artifacts/create_remote_wrapper.ral.json'
import { default as transferLocalToken } from './artifacts/transfer_local.ral.json'
import { default as transferRemoteToken } from './artifacts/transfer_remote.ral.json'
import { default as completeTransfer } from './artifacts/complete_transfer.ral.json'
import { default as attestToken } from './artifacts/attest_token.ral.json'
import { default as completeUndoneSequence } from './artifacts/complete_undone_sequence.ral.json'

export function createLocalTokenWrapperScript(): Script {
    return Script.fromJson(createLocalTokenWrapper)
}

export function createRemoteTokenWrapperScript(): Script {
    return Script.fromJson(createRemoteTokenWrapper)
}

export function transferLocalTokenScript(): Script {
    return Script.fromJson(transferLocalToken)
}

export function transferRemoteTokenScript(): Script {
    return Script.fromJson(transferRemoteToken)
}

export function completeTransferScript(): Script {
    return Script.fromJson(completeTransfer)
}

export function attestTokenScript(): Script {
    return Script.fromJson(attestToken)
}

export function completeUndoneSequenceScript(): Script {
    return Script.fromJson(completeUndoneSequence)
}

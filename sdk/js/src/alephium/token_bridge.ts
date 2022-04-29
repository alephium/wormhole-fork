import { Script } from 'alephium-web3'
import * as createLocalTokenWrapper from './artifacts/create_local_wrapper.ral.json'
import * as createRemoteTokenWrapper from './artifacts/create_remote_wrapper.ral.json'
import * as transferLocalToken from './artifacts/transfer_local.ral.json'
import * as transferRemoteToken from './artifacts/transfer_remote.ral.json'
import * as completeTransfer from './artifacts/complete_transfer.ral.json'
import * as attestToken from './artifacts/attest_token.ral.json'
import * as completeUndoneSequence from './artifacts/complete_undone_sequence.ral.json'

export function createLocalTokenWrapperScript(): Script {
    return Script.fromJsonModule(createLocalTokenWrapper)
}

export function createRemoteTokenWrapperScript(): Script {
    return Script.fromJsonModule(createRemoteTokenWrapper)
}

export function transferLocalTokenScript(): Script {
    return Script.fromJsonModule(transferLocalToken)
}

export function transferRemoteTokenScript(): Script {
    return Script.fromJsonModule(transferRemoteToken)
}

export function completeTransferScript(): Script {
    return Script.fromJsonModule(completeTransfer)
}

export function attestTokenScript(): Script {
    return Script.fromJsonModule(attestToken)
}

export function completeUndoneSequenceScript(): Script {
    return Script.fromJsonModule(completeUndoneSequence)
}

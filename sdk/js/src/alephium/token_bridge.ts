import { Script } from '@alephium/web3'
import { default as createLocalTokenPool } from './artifacts/token_bridge_scripts/create_local_token_pool.ral.json'
import { default as createRemoteTokenPool } from './artifacts/token_bridge_scripts/create_remote_token_pool.ral.json'
import { default as updateRemoteTokenPool } from './artifacts/token_bridge_scripts/update_remote_token_pool.ral.json'
import { default as createWrappedAlphPool } from './artifacts/token_bridge_scripts/create_wrapped_alph_pool.ral.json'
import { default as transferAlph } from './artifacts/token_bridge_scripts/transfer_alph.ral.json'
import { default as transferLocalToken } from './artifacts/token_bridge_scripts/transfer_local.ral.json'
import { default as transferRemoteToken } from './artifacts/token_bridge_scripts/transfer_remote.ral.json'
import { default as completeTransfer } from './artifacts/token_bridge_scripts/complete_transfer.ral.json'
import { default as attestToken } from './artifacts/token_bridge_scripts/attest_token.ral.json'
import { default as attestWrappedAlph } from './artifacts/token_bridge_scripts/attest_wrapped_alph.ral.json'
import { default as destroyUnexecutedSequences } from './artifacts/token_bridge_scripts/destroy_unexecuted_sequence_contracts.ral.json'
import { default as updateRefundAddress } from './artifacts/token_bridge_scripts/update_refund_address.ral.json'
import { default as upgradeContract } from './artifacts/token_bridge_scripts/upgrade_token_bridge_contract.ral.json'
import { default as updateMinimalConsistencyLevel } from './artifacts/token_bridge_scripts/update_minimal_consistency_level.ral.json'
import { default as deposit } from './artifacts/token_bridge_scripts/deposit.ral.json'

export function createLocalTokenPoolScript(): Script {
    return Script.fromJson(createLocalTokenPool)
}

export function createRemoteTokenPoolScript(): Script {
    return Script.fromJson(createRemoteTokenPool)
}

export function updateRemoteTokenPoolScript(): Script {
    return Script.fromJson(updateRemoteTokenPool)
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

export function destroyUnexecutedSequencesScript(): Script {
    return Script.fromJson(destroyUnexecutedSequences)
}

export function updateRefundAddressScript(): Script {
    return Script.fromJson(updateRefundAddress)
}

export function upgradeTokenBridgeContractScript(): Script {
    return Script.fromJson(upgradeContract)
}

export function updateMinimalConsistencyLevelScript(): Script {
    return Script.fromJson(updateMinimalConsistencyLevel)
}

export function depositScript(): Script {
    return Script.fromJson(deposit)
}

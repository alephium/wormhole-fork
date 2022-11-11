import { Script } from '@alephium/web3'
import { default as setMessageFee } from './artifacts/governance_scripts/set_message_fee.ral.json'
import { default as transferFee } from './artifacts/governance_scripts/transfer_fee.ral.json'
import { default as updateGuardianSet } from './artifacts/governance_scripts/update_guardian_set.ral.json'
import { default as upgradeContract } from './artifacts/governance_scripts/upgrade_governance_contract.ral.json'

export function setMessageFeeScript(): Script {
  return Script.fromJson(setMessageFee)
}

export function transferFeeScript(): Script {
  return Script.fromJson(transferFee)
}

export function updateGuardianSetScript(): Script {
  return Script.fromJson(updateGuardianSet)
}

export function upgradeGovernanceContractScript(): Script {
  return Script.fromJson(upgradeContract)
}

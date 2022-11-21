import { binToHex } from '@alephium/web3'
import { CHAIN_ID_ALEPHIUM } from 'alephium-wormhole-sdk'
import { execSync } from 'child_process'
import { assert, getBridgeChains, getSignedVAA } from '../utils'
import {
  getGuardianByIndex,
  getNextGovernanceSequence,
  governanceChainId,
  governanceEmitterId,
  injectVAA,
  runCmdInContainer,
  submitGovernanceVAA
} from './governance_utils'

const newConsistencyLevel = 1

function createUpdateConsistencyLevelVaa(sequence: number): string {
  return `
    current_set_index:  1
    messages:  {
      sequence: ${sequence}
      nonce:  0
      target_chain_id:  255
      update_minimal_consistency_level:  {
        new_consistency_level:  ${newConsistencyLevel}
      }
    }
  `
}

async function updateConsistencyLevel() {
  const alph = (await getBridgeChains()).alph
  const seq = await getNextGovernanceSequence()
  const updateConsistencyLevelVaa = createUpdateConsistencyLevelVaa(seq)
  const currentConsistencyLevel = (await alph.getTokenBridgeContractState()).fields['minimalConsistencyLevel'] as bigint
  assert(Number(currentConsistencyLevel) !== newConsistencyLevel)

  for (const guardianIndex of [0, 1]) {
    await injectVAA(updateConsistencyLevelVaa, guardianIndex, 'update-consistency-level.proto')
  }

  await submitGovernanceVAA('UpdateConsistencyLevel', seq, CHAIN_ID_ALEPHIUM)

  const expectedConsistencyLevel = (await alph.getTokenBridgeContractState()).fields[
    'minimalConsistencyLevel'
  ] as bigint
  assert(Number(expectedConsistencyLevel) === newConsistencyLevel)
}

updateConsistencyLevel()
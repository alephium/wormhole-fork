import { binToHex } from '@alephium/web3'
import { CHAIN_ID_ALEPHIUM } from '@alephium/wormhole-sdk'
import base58 from 'bs58'
import { assert, getBridgeChains } from '../utils'
import { getNextGovernanceSequence, guardianSetIndexes, injectVAA, submitGovernanceVAA } from './governance_utils'

const newRefundAddress = '1HfMbRS8JxUohvWw4bwUTWNQaqeG7ni96JwYt79sNHNtg'

function createUpdateRefundAddressVaa(sequence: number): string {
  return `
    current_set_index:  1
    messages:  {
      sequence:  ${sequence}
      nonce:  0
      target_chain_id:  255
      update_refund_address:  {
        new_refund_address:  "${binToHex(base58.decode(newRefundAddress))}"
      }
    }
  `
}

async function updateRefundAddress() {
  const alph = (await getBridgeChains()).alph
  const seq = await getNextGovernanceSequence()
  const updateRefundAddressVaa = createUpdateRefundAddressVaa(seq)
  const currentRefundAddress = (await alph.getTokenBridgeContractState()).fields.refundAddress
  assert(currentRefundAddress.toLowerCase() !== newRefundAddress.toLowerCase())

  for (const guardianIndex of guardianSetIndexes) {
    await injectVAA(updateRefundAddressVaa, guardianIndex, 'update-refund-address.proto')
  }

  await submitGovernanceVAA('UpdateRefundAddress', seq, CHAIN_ID_ALEPHIUM)

  const expectedRefundAddress = (await alph.getTokenBridgeContractState()).fields.refundAddress
  assert(expectedRefundAddress.toLowerCase() === newRefundAddress.toLowerCase())
}

updateRefundAddress()

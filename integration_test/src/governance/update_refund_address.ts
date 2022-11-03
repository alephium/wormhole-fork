import { binToHex } from '@alephium/web3'
import { CHAIN_ID_ALEPHIUM } from 'alephium-wormhole-sdk'
import base58 from 'bs58'
import { execSync } from 'child_process'
import { assert, getBridgeChains, getSignedVAA } from '../utils'
import {
  getGuardianByIndex,
  getNextGovernanceSequence,
  governanceChainId,
  governanceEmitterId,
  runCmdInContainer
} from './governance_utils'

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
  const currentRefundAddress = (await alph.getTokenBridgeContractState()).fields['refundAddress'] as string
  assert(currentRefundAddress.toLowerCase() !== newRefundAddress.toLowerCase())

  for (const guardianIndex of [0, 1]) {
    const container = await getGuardianByIndex(guardianIndex)
    const fileName = `update-refund-address.proto`
    await runCmdInContainer(container, ['bash', '-c', `echo '${updateRefundAddressVaa}' > ${fileName}`], '/')
    await runCmdInContainer(
      container,
      ['bash', '-c', `./guardiand admin governance-vaa-inject ${fileName} --socket /tmp/admin.sock`],
      '/'
    )
  }

  const signedVaa = await getSignedVAA(governanceChainId, governanceEmitterId, CHAIN_ID_ALEPHIUM, seq)
  const signedVaaHex = binToHex(signedVaa)
  console.log(`Update refund address vaa for Alephium: ${signedVaaHex}`)
  const submitCommand = `npm --prefix ../clients/js start -- submit ${signedVaaHex} -n devnet`
  console.log(`Submitting update refund address vaa to Alephium`)
  execSync(submitCommand)

  const expectedRefundAddress = (await alph.getTokenBridgeContractState()).fields['refundAddress'] as string
  assert(expectedRefundAddress.toLowerCase() === newRefundAddress.toLowerCase())
}

updateRefundAddress()

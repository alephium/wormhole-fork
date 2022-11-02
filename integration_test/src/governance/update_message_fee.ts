import { binToHex } from '@alephium/web3'
import { ChainId, coalesceChainName } from 'alephium-wormhole-sdk'
import { execSync } from 'child_process'
import { BridgeChain } from '../bridge_chain'
import { assert, getBridgeChains, getSignedVAA } from '../utils'
import {
  getGuardianByIndex,
  getNextGovernanceSequence,
  governanceChainId,
  governanceEmitterId,
  runCmdInContainer
} from './governance_utils'

function createUpdateMessageFeeVaa(sequence: number, messageFee: bigint, chainId: ChainId): string {
  const messageFeeHex = messageFee.toString(16).padStart(64, '0')
  return `
    current_set_index:  1
    messages:  {
      sequence: ${sequence}
      nonce: 0
      target_chain_id: ${chainId}
      update_message_fee:  {
        new_message_fee:  "${messageFeeHex}"
      }
    }
  `
}

async function updateMessageFeeOnChain(chain: BridgeChain) {
  const currentMessageFee = await chain.getCurrentMessageFee()
  console.log(`Current message fee on Alephium is ${currentMessageFee}`)
  const newMessageFee = currentMessageFee + 1000n
  const seq = await getNextGovernanceSequence()
  const updateMessageFeeVaa = createUpdateMessageFeeVaa(seq, newMessageFee, chain.chainId)
  for (const guardianIndex of [0, 1]) {
    const container = await getGuardianByIndex(guardianIndex)
    const fileName = `update-message-fee-${chain.chainId}.proto`
    await runCmdInContainer(container, ['bash', '-c', `echo '${updateMessageFeeVaa}' > ${fileName}`], '/')
    await runCmdInContainer(
      container,
      ['bash', '-c', `./guardiand admin governance-vaa-inject ${fileName} --socket /tmp/admin.sock`],
      '/'
    )
  }
  const signedVaa = await getSignedVAA(governanceChainId, governanceEmitterId, chain.chainId, seq)
  const signedVaaHex = binToHex(signedVaa)
  const chainName = coalesceChainName(chain.chainId)
  console.log(`Update message fee signed vaa for ${chainName}: ${signedVaaHex}`)
  const submitCommand = `npm --prefix ../clients/js start -- submit ${signedVaaHex} -n devnet`
  console.log(`Submitting update message fee vaa to ${chainName}`)
  execSync(submitCommand)

  const expectedMessageFee = await chain.getCurrentMessageFee()
  assert(expectedMessageFee === newMessageFee)
}

async function updateMessageFee() {
  const chains = await getBridgeChains()
  updateMessageFeeOnChain(chains.alph)
  updateMessageFeeOnChain(chains.eth)
}

updateMessageFee()

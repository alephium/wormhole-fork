import { ChainId } from 'alephium-wormhole-sdk'
import { BridgeChain } from '../bridge_chain'
import { assert, getBridgeChains } from '../utils'
import { getNextGovernanceSequence, injectVAA, submitGovernanceVAA } from './governance_utils'

const dustAmount = 10n ** 15n

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
  const newMessageFee = currentMessageFee + dustAmount
  const seq = await getNextGovernanceSequence()
  const updateMessageFeeVaa = createUpdateMessageFeeVaa(seq, newMessageFee, chain.chainId)
  for (const guardianIndex of [0, 1]) {
    await injectVAA(updateMessageFeeVaa, guardianIndex, `update-message-fee-${chain.chainId}.proto`)
  }

  await submitGovernanceVAA('UpdateMessageFee', seq, chain.chainId)

  const expectedMessageFee = await chain.getCurrentMessageFee()
  assert(expectedMessageFee === newMessageFee)
}

async function updateMessageFee() {
  const chains = await getBridgeChains()
  updateMessageFeeOnChain(chains.alph)
  updateMessageFeeOnChain(chains.eth)
}

updateMessageFee()

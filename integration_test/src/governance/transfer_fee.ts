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

const alphRecipientAddress = '1HfMbRS8JxUohvWw4bwUTWNQaqeG7ni96JwYt79sNHNtg'
const ethRecipientAddress = '0x46B591A30cEfa31E8bf8281C924766e6E424D26B'

function createTransferFeeVaa(chainId: ChainId, sequence: number, recipient: Uint8Array, amount: bigint): string {
  if (recipient.length !== 32) {
    throw new Error('Invalid transfer fee recipient address, expect 32 bytes')
  }
  return `
    current_set_index:  1
    messages:  {
      sequence:  ${sequence}
      nonce:  0
      target_chain_id:  ${chainId}
      transfer_fee:  {
        amount:  "${amount.toString(16).padStart(64, '0')}"
        recipient:  "${binToHex(recipient)}"
      }
    }
  `
}

async function transferFeeOnChain(chain: BridgeChain, recipient: string) {
  const recipientBalanceBeforeTransfer = await chain.getNativeTokenBalanceByAddress(recipient)
  const governanceBalanceBeforeTransfer = await chain.getNativeTokenBalanceByAddress(chain.governanceContractAddress)

  const chainName = coalesceChainName(chain.chainId)
  console.log(
    `Balances before transfer on ${chainName}, recipient: ${recipientBalanceBeforeTransfer}, governance contract: ${governanceBalanceBeforeTransfer}`
  )
  const seq = await getNextGovernanceSequence()
  const transferAmount = await chain.getCurrentMessageFee()
  console.log(`Transfer amount for ${chainName}: ${transferAmount}`)
  const transferFeeVaa = createTransferFeeVaa(chain.chainId, seq, chain.normalizeAddress(recipient), transferAmount)
  for (const guardianIndex of [0, 1]) {
    const container = await getGuardianByIndex(guardianIndex)
    const fileName = `transfer-fee-${chain.chainId}.proto`
    await runCmdInContainer(container, ['bash', '-c', `echo '${transferFeeVaa}' > ${fileName}`], '/')
    await runCmdInContainer(
      container,
      ['bash', '-c', `./guardiand admin governance-vaa-inject ${fileName} --socket /tmp/admin.sock`],
      '/'
    )
  }
  const signedVaa = await getSignedVAA(governanceChainId, governanceEmitterId, chain.chainId, seq)
  const signedVaaHex = binToHex(signedVaa)
  console.log(`Transfer fee signed vaa for ${chainName}: ${signedVaaHex}`)
  const submitCommand = `npm --prefix ../clients/js start -- submit ${signedVaaHex} -n devnet`
  console.log(`Submitting transfer fee vaa to ${chainName}`)
  execSync(submitCommand)

  const recipientBalanceAfterTransfer = await chain.getNativeTokenBalanceByAddress(recipient)
  const governanceBalanceAfterTransfer = await chain.getNativeTokenBalanceByAddress(chain.governanceContractAddress)
  assert(recipientBalanceBeforeTransfer + transferAmount === recipientBalanceAfterTransfer)
  assert(governanceBalanceAfterTransfer + transferAmount === governanceBalanceBeforeTransfer)
}

async function transferFee() {
  const chains = await getBridgeChains()
  transferFeeOnChain(chains.alph, alphRecipientAddress)
  transferFeeOnChain(chains.eth, ethRecipientAddress)
}

transferFee()

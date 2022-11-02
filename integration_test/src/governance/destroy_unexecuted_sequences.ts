import { addressFromContractId, binToHex, web3 } from '@alephium/web3'
import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ETH,
  contractExists,
  getTokenBridgeForChainId,
  getUnexecutedSequenceId
} from 'alephium-wormhole-sdk'
import { execSync } from 'child_process'
import { assert, getBridgeChains, getSignedVAA } from '../utils'
import {
  getGuardianByIndex,
  getNextGovernanceSequence,
  governanceChainId,
  governanceEmitterId,
  runCmdInContainer
} from './governance_utils'

const unexecutedSequenceIndex = 0

function createDestroyUnexecutedSequencesVaa(sequence: number): string {
  return `
    current_set_index:  1
    messages:  {
      sequence:  ${sequence}
      nonce:  0
      target_chain_id:  255
      destroy_unexecuted_sequence_contracts:  {
        emitter_chain: ${CHAIN_ID_ETH}
        sequences:  ${unexecutedSequenceIndex}
      }
    }
  `
}

async function createUnexecutedSequence() {
  const chains = await getBridgeChains()
  await chains.alph.deposit(CHAIN_ID_ETH, 5n * chains.alph.oneCoin)
  // transfer from Ethereum to Alephium, sequence is 513, TODO: improve this
  const vaaHex = '01000000010200d41571b3e10141df5c3fd3c332a42327ec0c6e78fe5cec4a3d807abccfce9674558daa0a8d8f78b19a01557e0dd8be842370aaae8c3e520a0269c7f3d5e9e2ce0101f9f91cc48a6955ad5711df0efd3897dd2b7f9f92a5721833dc21ec27a8795b8901e3bb1933e96e5e1bd687e6ceceec6de34081e9a855ab40eed43b30bf4a089a000000000000000000000200ff0000000000000000000000000290fb167208af455bb137780163b7b7a9a10c1600000000000002010f010000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000ddb64fe46a91d46ee29420539fc25fd07c5fea3e0002bee85f379545a2ed9f6cceb331288842f378cf0f04012ad4ac8824aae7d6f80a0000000000000000000000000000000000000000000000000000000000000000'
  const signedVaa = Buffer.from(vaaHex, 'hex')
  await chains.alph.redeemToken(signedVaa)
}

async function destroyUnexecutedSequences() {
  const chains = await getBridgeChains()
  const alph = chains.alph

  const tokenBridgeForChainId = getTokenBridgeForChainId(alph.tokenBridgeContractId, CHAIN_ID_ETH)
  const tokenBridgeForChainAddress = addressFromContractId(tokenBridgeForChainId)
  const state0 = await alph.getContractState(tokenBridgeForChainAddress, 'TokenBridgeForChain')
  assert(Number(state0.fields['start'] as bigint) === 0)

  const unexecutedSequenceContractId = getUnexecutedSequenceId(tokenBridgeForChainId, unexecutedSequenceIndex)
  const exists0 = await contractExists(unexecutedSequenceContractId, web3.getCurrentNodeProvider())
  assert(!exists0)

  await createUnexecutedSequence()
  const state1 = await alph.getContractState(tokenBridgeForChainAddress, 'TokenBridgeForChain')
  assert(Number(state1.fields['start'] as bigint) === 256)

  const exists1 = await contractExists(unexecutedSequenceContractId, web3.getCurrentNodeProvider())
  assert(exists1)

  const seq = await getNextGovernanceSequence()
  const destroyUnexecutedSequencesVaa = createDestroyUnexecutedSequencesVaa(seq)

  for (const guardianIndex of [0, 1]) {
    const container = await getGuardianByIndex(guardianIndex)
    const fileName = `destroy-unexecuted-sequences.proto`
    await runCmdInContainer(container, ['bash', '-c', `echo '${destroyUnexecutedSequencesVaa}' > ${fileName}`], '/')
    await runCmdInContainer(
      container,
      ['bash', '-c', `./guardiand admin governance-vaa-inject ${fileName} --socket /tmp/admin.sock`],
      '/'
    )
  }

  const balanceBeforeDestroy = await alph.getNativeTokenBalanceByAddress(tokenBridgeForChainAddress)

  const signedVaa = await getSignedVAA(governanceChainId, governanceEmitterId, CHAIN_ID_ALEPHIUM, seq)
  const signedVaaHex = binToHex(signedVaa)
  console.log(`Destroy unexecuted sequences vaa for Alephium: ${signedVaaHex}`)
  const submitCommand = `npm --prefix ../clients/js start -- submit ${signedVaaHex} -n devnet --contractId ${alph.tokenBridgeContractId}`
  console.log(`Submitting destroy unexecuted sequences vaa to Alephium`)
  execSync(submitCommand)

  const balanceAfterDestroy = await alph.getNativeTokenBalanceByAddress(tokenBridgeForChainAddress)
  assert(balanceBeforeDestroy + alph.oneCoin === balanceAfterDestroy)
}

destroyUnexecutedSequences()

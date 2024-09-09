import { addressFromContractId, web3 } from '@alephium/web3'
import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ETH,
  contractExists,
  getTokenBridgeForChainId,
  getUnexecutedSequenceId,
  serializeVAA,
  TransferToken,
  VAA,
  signVAABody,
  VAABody,
  alephium_contracts
} from '@alephium/wormhole-sdk'
import { assert, getBridgeChains } from '../utils'
import { getNextGovernanceSequence, guardianSetIndexes, injectVAA, submitGovernanceVAA } from './governance_utils'
import { default as ethDevnetConfig } from '../../../configs/ethereum/devnet.json'

const unexecutedSequenceIndex = 0
const guardianKeys = [
  'cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0',
  'c3b2e45c422a1602333a64078aeb42637370b0f48fe385f9cfa6ad54a8e0c47e',
  '9f790d3f08bc4b5cd910d4278f3deb406e57bb5e924906ccd52052bb078ccd47'
]

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
  const transferTokenPayload: TransferToken = {
    type: 'TransferToken',
    amount: 1000000000000000000n,
    originAddress: Buffer.from(ethDevnetConfig.contracts.wrappedNative.slice(2).padStart(64, '0'), 'hex'),
    originChain: CHAIN_ID_ETH,
    targetAddress: Buffer.from('00bee85f379545a2ed9f6cceb331288842f378cf0f04012ad4ac8824aae7d6f80a', 'hex'),
    fee: 0n
  }
  const vaaBody: VAABody<TransferToken> = {
    timestamp: 0,
    nonce: 0,
    emitterChainId: CHAIN_ID_ETH,
    targetChainId: CHAIN_ID_ALEPHIUM,
    emitterAddress: Buffer.from(ethDevnetConfig.tokenBridgeEmitterAddress, 'hex'),
    sequence: 513n,
    consistencyLevel: 15,
    payload: transferTokenPayload
  }
  const vaa: VAA<TransferToken> = {
    version: 1,
    guardianSetIndex: 1,
    signatures: signVAABody(guardianKeys, vaaBody),
    body: vaaBody
  }
  await chains.alph.redeemToken(serializeVAA(vaa))
}

async function destroyUnexecutedSequences() {
  const chains = await getBridgeChains()
  const alph = chains.alph

  const tokenBridgeForChainId = getTokenBridgeForChainId(alph.tokenBridgeContractId, CHAIN_ID_ETH, alph.groupIndex)
  const tokenBridgeForChainAddress = addressFromContractId(tokenBridgeForChainId)
  const state0 = await alph.getContractState(alephium_contracts.TokenBridgeForChain, tokenBridgeForChainAddress)
  assert(state0.fields.start === 0n)

  const unexecutedSequenceContractId = getUnexecutedSequenceId(
    tokenBridgeForChainId,
    unexecutedSequenceIndex,
    alph.groupIndex
  )
  const exists0 = await contractExists(unexecutedSequenceContractId, web3.getCurrentNodeProvider())
  assert(!exists0)

  await createUnexecutedSequence()
  const state1 = await alph.getContractState(alephium_contracts.TokenBridgeForChain, tokenBridgeForChainAddress)
  assert(state1.fields.start === 256n)

  const exists1 = await contractExists(unexecutedSequenceContractId, web3.getCurrentNodeProvider())
  assert(exists1)

  const seq = await getNextGovernanceSequence()
  const destroyUnexecutedSequencesVaa = createDestroyUnexecutedSequencesVaa(seq)

  for (const guardianIndex of guardianSetIndexes) {
    await injectVAA(destroyUnexecutedSequencesVaa, guardianIndex, 'destroy-unexecuted-sequences.proto')
  }

  const balanceBeforeDestroy = await alph.getNativeTokenBalanceByAddress(tokenBridgeForChainAddress)
  await submitGovernanceVAA('DestroyUnexecutedSequences', seq, CHAIN_ID_ALEPHIUM)
  const balanceAfterDestroy = await alph.getNativeTokenBalanceByAddress(tokenBridgeForChainAddress)
  assert(balanceBeforeDestroy + alph.oneCoin === balanceAfterDestroy)
}

destroyUnexecutedSequences()

import { addressFromContractId, web3 } from '@alephium/web3'
import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ETH,
  contractExists,
  getTokenBridgeForChainId,
  getUnexecutedSequenceId,
  serializeVAA,
  serializeVAABody,
  Signature,
  TransferToken,
  VAA,
  VAABody
} from 'alephium-wormhole-sdk'
import { keccak256 } from 'ethers/lib/utils'
import { assert, getBridgeChains } from '../utils'
import { getNextGovernanceSequence, injectVAA, submitGovernanceVAA } from './governance_utils'
import * as elliptic from 'elliptic'

const unexecutedSequenceIndex = 0
const guardianKeys = [
  'cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0',
  'c3b2e45c422a1602333a64078aeb42637370b0f48fe385f9cfa6ad54a8e0c47e'
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

function sign(keys: string[], bytes: Uint8Array): Signature[] {
  const ec = new elliptic.ec('secp256k1')
  const hash = keccak256(keccak256(bytes)).slice(2)
  return keys.map((k, index) => {
    const key = ec.keyFromPrivate(k)
    const sig = key.sign(hash, { canonical: true })
    const signature = [
      sig.r.toString(16).padStart(64, '0'),
      sig.s.toString(16).padStart(64, '0'),
      (sig.recoveryParam as number).toString(16).padStart(2, '0')
    ].join('')
    return new Signature(index, Buffer.from(signature, 'hex'))
  })
}

async function createUnexecutedSequence() {
  const chains = await getBridgeChains()
  await chains.alph.deposit(CHAIN_ID_ETH, 5n * chains.alph.oneCoin)
  const transferTokenPayload: TransferToken = {
    type: 'TransferToken',
    amount: 1000000000000000000n,
    originAddress: Buffer.from('000000000000000000000000ddb64fe46a91d46ee29420539fc25fd07c5fea3e', 'hex'),
    originChain: CHAIN_ID_ETH,
    targetAddress: Buffer.from('bee85f379545a2ed9f6cceb331288842f378cf0f04012ad4ac8824aae7d6f80a', 'hex'),
    fee: 0n
  }
  const vaaBody: VAABody<TransferToken> = {
    timestamp: 0,
    nonce: 0,
    emitterChainId: CHAIN_ID_ETH,
    targetChainId: CHAIN_ID_ALEPHIUM,
    emitterAddress: Buffer.from('0000000000000000000000000290fb167208af455bb137780163b7b7a9a10c16', 'hex'),
    sequence: 513n,
    consistencyLevel: 15,
    payload: transferTokenPayload
  }
  const vaaBodyBytes = serializeVAABody(vaaBody)
  const vaa: VAA<TransferToken> = {
    version: 1,
    guardianSetIndex: 1,
    signatures: sign(guardianKeys, vaaBodyBytes),
    body: vaaBody
  }
  await chains.alph.redeemToken(serializeVAA(vaa))
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
    await injectVAA(destroyUnexecutedSequencesVaa, guardianIndex, 'destroy-unexecuted-sequences.proto')
  }

  const balanceBeforeDestroy = await alph.getNativeTokenBalanceByAddress(tokenBridgeForChainAddress)
  await submitGovernanceVAA('DestroyUnexecutedSequences', seq, CHAIN_ID_ALEPHIUM)
  const balanceAfterDestroy = await alph.getNativeTokenBalanceByAddress(tokenBridgeForChainAddress)
  assert(balanceBeforeDestroy + alph.oneCoin === balanceAfterDestroy)
}

destroyUnexecutedSequences()

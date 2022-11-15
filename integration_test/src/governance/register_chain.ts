import { web3 } from '@alephium/web3'
import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ETHEREUM_ROPSTEN,
  CHAIN_ID_UNSET,
  contractExists,
  getAttestTokenHandlerId,
  getTokenBridgeForChainId
} from 'alephium-wormhole-sdk'
import { assert, getBridgeChains } from '../utils'
import { getNextGovernanceSequence, injectVAA, submitGovernanceVAA } from './governance_utils'

const testChainId = CHAIN_ID_ETHEREUM_ROPSTEN
const testEmitterAddress = '0000000000000000000000000290fb167208af455bb137780163b7b7a9a10c16'

function createRegisterChainVaa(sequence: number): string {
  return `
    current_set_index: 1
    messages: {
      sequence: ${sequence}
      nonce: 0
      bridge_register_chain: {
        module: "TokenBridge",
        chain_id: ${testChainId},
        emitter_address: "${testEmitterAddress}"
      }
    }
  `
}

async function registerChain() {
  const alph = (await getBridgeChains()).alph
  const attestTokenHandlerId0 = getAttestTokenHandlerId(alph.tokenBridgeContractId, testChainId)
  const tokenBridgeForChainId0 = getTokenBridgeForChainId(alph.tokenBridgeContractId, testChainId)

  assert((await contractExists(attestTokenHandlerId0, web3.getCurrentNodeProvider())) == false)
  assert((await contractExists(tokenBridgeForChainId0, web3.getCurrentNodeProvider())) == false)

  const seq = await getNextGovernanceSequence()
  const registerChainVaa = createRegisterChainVaa(seq)

  for (const guardianIndex of [0, 1]) {
    await injectVAA(registerChainVaa, guardianIndex, 'update-refund-address.proto')
  }
  await submitGovernanceVAA('RegisterChain', seq, CHAIN_ID_UNSET, [CHAIN_ID_ALEPHIUM])

  const attestTokenHandlerId1 = getAttestTokenHandlerId(alph.tokenBridgeContractId, testChainId)
  const tokenBridgeForChainId1 = getTokenBridgeForChainId(alph.tokenBridgeContractId, testChainId)

  assert((await contractExists(attestTokenHandlerId1, web3.getCurrentNodeProvider())) == true)
  assert((await contractExists(tokenBridgeForChainId1, web3.getCurrentNodeProvider())) == true)
}

registerChain()

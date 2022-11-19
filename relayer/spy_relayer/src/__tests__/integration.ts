import {
  approveEth,
  attestFromEth,
  CHAIN_ID_ETH,
  createWrappedOnEth,
  getEmitterAddressEth,
  parseSequenceFromLogEth,
  transferFromEth,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_UNSET,
  createRemoteTokenPoolOnAlph,
  getAttestTokenHandlerId,
  tryNativeToHexString,
  getIsTransferCompletedAlph,
  getTokenBridgeForChainId,
  attestFromAlph,
  parseSequenceFromLogAlph,
  getIsTransferCompletedEth,
  transferLocalTokenFromAlph,
  getSignedVAAWithRetry,
  uint8ArrayToHex
} from 'alephium-wormhole-sdk'
import { parseUnits } from '@ethersproject/units'
import { NodeHttpTransport } from '@improbable-eng/grpc-web-node-http-transport'
import { describe, expect, jest, test } from '@jest/globals'
import { ethers } from 'ethers'
import axios from 'axios'
import {
  ETH_NODE_URL,
  ETH_PRIVATE_KEY,
  ETH_TOKEN_BRIDGE_ADDRESS,
  TEST_ERC20,
  WORMHOLE_RPC_HOSTS,
  SPY_RELAY_URL,
  ETH_CORE_BRIDGE_ADDRESS,
  ALPH_NODE_URL,
  ALPH_MNEMONIC,
  ALPH_GROUP_INDEX,
  ALPH_TOKEN_BRIDGE_ID,
  ONE_ALPH,
  ALPH_TEST_TOKEN_ID
} from './env'
import { sleep } from '../helpers/utils'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { web3, node, NodeProvider, binToHex, bs58 } from '@alephium/web3'
import { arrayify } from 'ethers/lib/utils'

jest.setTimeout(60000)

test('Verify Spy Relay is running', async () => {
  try {
    console.log(`Sending query to spy relay to see if it's running, query: ${SPY_RELAY_URL}`)
    const result = await axios.get(SPY_RELAY_URL)
    expect(result).toHaveProperty('status')
    expect(result.status).toBe(200)
  } catch (e) {
    console.error(`Spy Relay does not appear to be running, error: ${e}`)
    throw e
  }
})

let sequence: string
let emitterAddress: string
let transferSignedVAA: Uint8Array

describe('Alephium to Ethereum', () => {
  web3.setCurrentNodeProvider(ALPH_NODE_URL)
  const alphWallet = PrivateKeyWallet.FromMnemonicWithGroup(ALPH_MNEMONIC, ALPH_GROUP_INDEX)
  const ethProvider = new ethers.providers.JsonRpcProvider(ETH_NODE_URL)
  const ethWallet = new ethers.Wallet(ETH_PRIVATE_KEY, ethProvider)

  test('Attest Alephium test token to Ethereum', async () => {
    try {
      const attestResult = await attestFromAlph(
        alphWallet,
        ALPH_TOKEN_BRIDGE_ID,
        ALPH_TEST_TOKEN_ID,
        alphWallet.account.address,
        ONE_ALPH,
        1
      )
      await waitAlphTxConfirmed(web3.getCurrentNodeProvider(), attestResult.txId, 1)
      console.log(`Attest transaction ${attestResult.txId} confirmed`)
      // get the sequence from the logs (needed to fetch the vaa)
      const events = await web3.getCurrentNodeProvider()
        .events
        .getEventsTxIdTxid(attestResult.txId)
      const sequence = parseSequenceFromLogAlph(events.events[0])
      console.log(`Attest sequence: ${sequence}`)
      const emitterAddress = ALPH_TOKEN_BRIDGE_ID
      // poll until the guardian(s) witness and sign the vaa
      const { vaaBytes: signedVAA } = await getSignedVAAWithRetry(
        WORMHOLE_RPC_HOSTS,
        CHAIN_ID_ALEPHIUM,
        emitterAddress,
        CHAIN_ID_UNSET,
        sequence,
        {
          transport: NodeHttpTransport(),
        }
      )
      console.log(`Got signed vaa: ${binToHex(signedVAA)}`)
      try {
        await createWrappedOnEth(ETH_TOKEN_BRIDGE_ADDRESS, ethWallet, signedVAA)
      } catch (e) {
        // this could fail because the token is already attested (in an unclean env)
      }
      console.log(`Wrapped token created on Ethereum`)
    } catch (e) {
      console.error(`An error occurred while trying to attest from Alephium to Ethereum, error: ${e}`)
      throw e
    }
  })

  test('Send Alephium test token to Ethereum', async () => {
    try {
      const recipientAddress = await ethWallet.getAddress()
      const amount = 1000n
      const transferResult = await transferLocalTokenFromAlph(
        alphWallet,
        ALPH_TOKEN_BRIDGE_ID,
        alphWallet.account.address,
        ALPH_TEST_TOKEN_ID,
        CHAIN_ID_ETH,
        uint8ArrayToHex(arrayify(recipientAddress)),
        amount,
        ONE_ALPH,
        0n,
        1
      )
      await waitAlphTxConfirmed(web3.getCurrentNodeProvider(), transferResult.txId, 1)
      console.log(`Transfer token tx ${transferResult.txId} confirmed`)
      // get the sequence from the logs (needed to fetch the vaa)
      const events = await web3.getCurrentNodeProvider()
        .events
        .getEventsTxIdTxid(transferResult.txId)
      sequence = parseSequenceFromLogAlph(events.events[0])
      emitterAddress = ALPH_TOKEN_BRIDGE_ID
      // poll until the guardian(s) witness and sign the vaa
      console.log(`Tranfer token sequence: ${sequence}`)
      const { vaaBytes: signedVAA } = await getSignedVAAWithRetry(
        WORMHOLE_RPC_HOSTS,
        CHAIN_ID_ALEPHIUM,
        emitterAddress,
        CHAIN_ID_ETH,
        sequence,
        {
          transport: NodeHttpTransport(),
        }
      )
      console.log(`Got signed vaa: ${binToHex(signedVAA)}`)
      transferSignedVAA = signedVAA
    } catch (e) {
      console.error(`An error occurred while trying to send from Alephium to Ethereum, error: ${e}`)
      throw e
    }
  })

  test('Spy Relay redeemed on Ethereum', async () => {
    try {
      let success: boolean = false
      for (let count = 0; count < 5 && !success; ++count) {
        console.log(`Sleeping before querying spy relay, timestamp: ${new Date().toLocaleString()}`)
        await sleep(5000)
        success = await getIsTransferCompletedEth(
          ETH_TOKEN_BRIDGE_ADDRESS,
          ethProvider,
          transferSignedVAA
        )
        console.log(`Check transfer completed returned ${success}, count is ${count}`)
      }

      expect(success).toBe(true)

    } catch (e) {
      console.error(`An error occurred while trying to redeem on Ethereum, error: ${e}`)
      throw e
    }
  })
})

describe('Ethereum to Alephium', () => {
  web3.setCurrentNodeProvider(ALPH_NODE_URL)
  const alphWallet = PrivateKeyWallet.FromMnemonicWithGroup(ALPH_MNEMONIC, ALPH_GROUP_INDEX)
  const ethProvider = new ethers.providers.JsonRpcProvider(ETH_NODE_URL);
  const ethWallet = new ethers.Wallet(ETH_PRIVATE_KEY, ethProvider);

  test('Attest Ethereum ERC-20 to Alephium', async () => {
    try {
      // attest the test token
      const receipt = await attestFromEth(
        ETH_TOKEN_BRIDGE_ADDRESS,
        ethWallet,
        TEST_ERC20
      )
      // get the sequence from the logs (needed to fetch the vaa)
      const sequence = parseSequenceFromLogEth(receipt, ETH_CORE_BRIDGE_ADDRESS)
      console.log(`Attest token sequence: ${sequence}`)
      const emitterAddress = getEmitterAddressEth(ETH_TOKEN_BRIDGE_ADDRESS)
      // poll until the guardian(s) witness and sign the vaa
      const { vaaBytes: signedVAA } = await getSignedVAAWithRetry(
        WORMHOLE_RPC_HOSTS,
        CHAIN_ID_ETH,
        emitterAddress,
        CHAIN_ID_UNSET,
        sequence,
        {
          transport: NodeHttpTransport(),
        }
      )
      console.log(`Got signed vaa: ${binToHex(signedVAA)}`)

      const attestTokenHandlerId = getAttestTokenHandlerId(ALPH_TOKEN_BRIDGE_ID, CHAIN_ID_ETH)
      const createWrappedResult = await createRemoteTokenPoolOnAlph(
        alphWallet,
        attestTokenHandlerId,
        signedVAA,
        alphWallet.account.address,
        ONE_ALPH
      )
      console.log(`Create wrapped token tx id: ${createWrappedResult.txId}`)
    } catch (e) {
      console.error(`An error occurred while trying to attest from Ethereum to Alephium, error: ${e}`)
      throw e
    }
  })

  test('Send Ethereum ERC-20 to Alephium', async () => {
    try {
      const amount = parseUnits("1", 18);
      // approve the bridge to spend tokens
      await approveEth(ETH_TOKEN_BRIDGE_ADDRESS, TEST_ERC20, ethWallet, amount)
      // transfer tokens
      const recipientAddress = bs58.decode(alphWallet.address)
      const receipt = await transferFromEth(
        ETH_TOKEN_BRIDGE_ADDRESS,
        ethWallet,
        TEST_ERC20,
        amount,
        CHAIN_ID_ALEPHIUM,
        recipientAddress
      )
      // get the sequence from the logs (needed to fetch the vaa)
      sequence = parseSequenceFromLogEth(receipt, ETH_CORE_BRIDGE_ADDRESS)
      console.log(`Transfer token sequence: ${sequence}`)
      emitterAddress = getEmitterAddressEth(ETH_TOKEN_BRIDGE_ADDRESS)
      // poll until the guardian(s) witness and sign the vaa
      const { vaaBytes: signedVAA } = await getSignedVAAWithRetry(
        WORMHOLE_RPC_HOSTS,
        CHAIN_ID_ETH,
        emitterAddress,
        CHAIN_ID_ALEPHIUM,
        sequence,
        {
          transport: NodeHttpTransport(),
        }
      )
      console.log(`Got signed vaa: ${binToHex(signedVAA)}`)
      transferSignedVAA = signedVAA;
    } catch (e) {
      console.error(`An error occurred while trying to send from Ethereum to Alephium, error: ${e}`)
      throw e
    }
  })

  test('Spy Relay redeemed on Alephium', async () => {
    try {
      const tokenBridgeForChainId = getTokenBridgeForChainId(ALPH_TOKEN_BRIDGE_ID, CHAIN_ID_ETH)
      let success: boolean = false
      for (let count = 0; count < 5 && !success; ++count) {
        console.log(`Sleeping before querying spy relay: timestamp: ${new Date().toLocaleString()}`)
        await sleep(5000)
        success = await getIsTransferCompletedAlph(
          web3.getCurrentNodeProvider(),
          tokenBridgeForChainId,
          ALPH_GROUP_INDEX,
          transferSignedVAA
        )
        console.log(`Check transfer completed returned ${success}, count is ${count}`)
      }

      expect(success).toBe(true)

    } catch (e) {
      console.error(`An error occurred while trying to redeem on Alephium, error: ${e}`)
      throw e
    }
  })
})

function isConfirmed(txStatus: node.TxStatus): txStatus is node.Confirmed {
  return txStatus.type === 'Confirmed'
}

// TODO: add this to SDK
export async function waitAlphTxConfirmed(
  provider: NodeProvider,
  txId: string,
  confirmations: number
): Promise<node.Confirmed> {
  const status = await provider.transactions.getTransactionsStatus({ txId: txId })
  if (isConfirmed(status) && status.chainConfirmations >= confirmations) {
    return status
  }
  await new Promise((r) => setTimeout(r, 1000))
  return waitAlphTxConfirmed(provider, txId, confirmations)
}

import {
  approveEth,
  CHAIN_ID_ETH,
  getEmitterAddressEth,
  parseSequenceFromLogEth,
  transferFromEth,
  CHAIN_ID_ALEPHIUM,
  getIsTransferCompletedAlph,
  getTokenBridgeForChainId,
  parseSequenceFromLogAlph,
  getIsTransferCompletedEth,
  transferLocalTokenFromAlph,
  getSignedVAAWithRetry,
  uint8ArrayToHex,
  waitAlphTxConfirmed,
  ethers_contracts,
  CHAIN_ID_BSC
} from 'alephium-wormhole-sdk'
import { NodeHttpTransport } from '@improbable-eng/grpc-web-node-http-transport'
import { describe, expect, jest, test } from '@jest/globals'
import axios from 'axios'
import {
  ETH_CHAIN,
  WORMHOLE_RPC_HOSTS,
  SPY_RELAY_URL,
  ALPH_TOKEN_BRIDGE_ID,
  ALPH_CONFIG,
  EvmChainConfig,
  ALPH_PRIVATE_KEY,
  BSC_CHAIN
} from './test_env'
import { sleep } from '../helpers/utils'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { web3, binToHex, bs58, ALPH_TOKEN_ID, ONE_ALPH } from '@alephium/web3'
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

web3.setCurrentNodeProvider(ALPH_CONFIG.nodeUrl)
const alphWallet = new PrivateKeyWallet({privateKey: ALPH_PRIVATE_KEY})

async function transferFromAlphToEvmChain(evmChain: EvmChainConfig, amount: bigint = ONE_ALPH) {
  const recipientAddress = await evmChain.wallet.getAddress()
  return await transferLocalTokenFromAlph(
    alphWallet,
    ALPH_TOKEN_BRIDGE_ID,
    alphWallet.account.address,
    ALPH_TOKEN_ID,
    evmChain.chainInfo.chainId,
    uint8ArrayToHex(arrayify(recipientAddress)),
    amount,
    ONE_ALPH,
    0n,
    1
  )
}

async function getCurrentMessageFee(evmChain: EvmChainConfig): Promise<bigint> {
  const governance = ethers_contracts.Governance__factory.connect(evmChain.coreBridgeAddress, evmChain.wallet)
  const messageFee = await governance.messageFee()
  return messageFee.toBigInt()
}

async function transferFromEvmChainToALph(evmChain: EvmChainConfig, amount: bigint = ONE_ALPH) {
  const currentMessageFee = await getCurrentMessageFee(evmChain)
  const evmTxOptions = {
    gasLimit: 5000000,
    gasPrice: 1000000,
    value: currentMessageFee
  }
  await approveEth(evmChain.tokenBridgeAddress, evmChain.testToken, evmChain.wallet, amount)
  // transfer tokens
  const recipientAddress = bs58.decode(alphWallet.address)
  return await transferFromEth(
    evmChain.tokenBridgeAddress,
    evmChain.wallet,
    evmChain.testToken,
    amount,
    CHAIN_ID_ALEPHIUM,
    recipientAddress,
    undefined,
    evmTxOptions
  )
}

describe('Alephium to Ethereum', () => {
  test('Send Alephium token to Ethereum', async () => {
    try {
      const transferResult = await transferFromAlphToEvmChain(ETH_CHAIN)
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
          ETH_CHAIN.tokenBridgeAddress,
          ETH_CHAIN.provider,
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
  test('Send Ethereum ERC-20 to Alephium', async () => {
    try {
      const receipt = await transferFromEvmChainToALph(ETH_CHAIN)
      // get the sequence from the logs (needed to fetch the vaa)
      sequence = parseSequenceFromLogEth(receipt, ETH_CHAIN.coreBridgeAddress)
      console.log(`Transfer token sequence: ${sequence}`)
      emitterAddress = getEmitterAddressEth(ETH_CHAIN.tokenBridgeAddress)
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
      const tokenBridgeForChainId = getTokenBridgeForChainId(ALPH_TOKEN_BRIDGE_ID, CHAIN_ID_ETH, ALPH_CONFIG.groupIndex)
      let success: boolean = false
      for (let count = 0; count < 5 && !success; ++count) {
        console.log(`Sleeping before querying spy relay: timestamp: ${new Date().toLocaleString()}`)
        await sleep(5000)
        success = await getIsTransferCompletedAlph(
          tokenBridgeForChainId,
          ALPH_CONFIG.groupIndex,
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

describe('Alephium to BSC', () => {
  test('Send Alephium token to BSC', async () => {
    try {
      const transferResult = await transferFromAlphToEvmChain(BSC_CHAIN)
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
        CHAIN_ID_BSC,
        sequence,
        {
          transport: NodeHttpTransport(),
        }
      )
      console.log(`Got signed vaa: ${binToHex(signedVAA)}`)
      transferSignedVAA = signedVAA
    } catch (e) {
      console.error(`An error occurred while trying to send from Alephium to BSC, error: ${e}`)
      throw e
    }
  })

  test('Spy Relay redeemed on BSC', async () => {
    try {
      let success: boolean = false
      for (let count = 0; count < 5 && !success; ++count) {
        console.log(`Sleeping before querying spy relay, timestamp: ${new Date().toLocaleString()}`)
        await sleep(5000)
        success = await getIsTransferCompletedEth(
          BSC_CHAIN.tokenBridgeAddress,
          BSC_CHAIN.provider,
          transferSignedVAA
        )
        console.log(`Check transfer completed returned ${success}, count is ${count}`)
      }

      expect(success).toBe(true)

    } catch (e) {
      console.error(`An error occurred while trying to redeem on BSC, error: ${e}`)
      throw e
    }
  })
})

describe('BSC to Alephium', () => {
  test('Send BSC test token to Alephium', async () => {
    try {
      const receipt = await transferFromEvmChainToALph(BSC_CHAIN)
      // get the sequence from the logs (needed to fetch the vaa)
      sequence = parseSequenceFromLogEth(receipt, BSC_CHAIN.coreBridgeAddress)
      console.log(`Transfer token sequence: ${sequence}`)
      emitterAddress = getEmitterAddressEth(BSC_CHAIN.tokenBridgeAddress)
      // poll until the guardian(s) witness and sign the vaa
      const { vaaBytes: signedVAA } = await getSignedVAAWithRetry(
        WORMHOLE_RPC_HOSTS,
        CHAIN_ID_BSC,
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
      console.error(`An error occurred while trying to send from BSC to Alephium, error: ${e}`)
      throw e
    }
  })

  test('Spy Relay redeemed on Alephium', async () => {
    try {
      const tokenBridgeForChainId = getTokenBridgeForChainId(ALPH_TOKEN_BRIDGE_ID, CHAIN_ID_BSC, ALPH_CONFIG.groupIndex)
      let success: boolean = false
      for (let count = 0; count < 5 && !success; ++count) {
        console.log(`Sleeping before querying spy relay: timestamp: ${new Date().toLocaleString()}`)
        await sleep(5000)
        success = await getIsTransferCompletedAlph(
          tokenBridgeForChainId,
          ALPH_CONFIG.groupIndex,
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

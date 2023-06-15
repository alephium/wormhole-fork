import {
  CHAIN_ID_ETH,
  parseSequenceFromLogEth,
  transferFromEthNative,
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
  CHAIN_ID_BSC,
  ChainId,
  coalesceChainName
} from 'alephium-wormhole-sdk'
import { NodeHttpTransport } from '@improbable-eng/grpc-web-node-http-transport'
import { describe, expect, jest, test } from '@jest/globals'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { web3, binToHex, bs58, ALPH_TOKEN_ID, ONE_ALPH, sleep } from '@alephium/web3'
import { arrayify } from 'ethers/lib/utils'
import * as dotenv from "dotenv"
import path from 'path'
import { getConfig } from './config'
import { encodeEmitterAddress, getAlephiumGroupIndex, getGovernanceAddress, getNodeUrl, getTokenBridgeAddress, newEVMProvider } from './utils'
import { ethers } from 'ethers'
import { default as devnetGuardianConfig } from '../../configs/guardian/devnet.json'

dotenv.config({ path: path.join(process.cwd(), '.env.devnet') })

jest.setTimeout(60000)

let sequence: string
let emitterAddress: string
let transferSignedVAA: Uint8Array

const config = getConfig()
web3.setCurrentNodeProvider(getNodeUrl(config.networkId, CHAIN_ID_ALEPHIUM))
const alphWallet = new PrivateKeyWallet({privateKey: config.privateKeys[CHAIN_ID_ALEPHIUM]![0]})
const alphTokenBridgeAddress = getTokenBridgeAddress(config.networkId, CHAIN_ID_ALEPHIUM)

async function transferFromAlphToEvmChain(chainId: ChainId, amount: bigint = ONE_ALPH) {
  try {
    const recipientAddress = config.addresses[chainId]![0]
    const transferResult = await transferLocalTokenFromAlph(
      alphWallet,
      getTokenBridgeAddress(config.networkId, CHAIN_ID_ALEPHIUM),
      alphWallet.account.address,
      ALPH_TOKEN_ID,
      chainId,
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
    const tokenBridgeAddress = getTokenBridgeAddress(config.networkId, CHAIN_ID_ALEPHIUM)
    emitterAddress = encodeEmitterAddress(CHAIN_ID_ALEPHIUM, tokenBridgeAddress)
    // poll until the guardian(s) witness and sign the vaa
    console.log(`Tranfer token sequence: ${sequence}`)
    const { vaaBytes: signedVAA } = await getSignedVAAWithRetry(
      devnetGuardianConfig.guardianUrls,
      CHAIN_ID_ALEPHIUM,
      emitterAddress,
      chainId,
      sequence,
      {
        transport: NodeHttpTransport(),
      }
    )
    console.log(`Got signed vaa: ${binToHex(signedVAA)}`)
    transferSignedVAA = signedVAA
  } catch (e) {
    console.error(`An error occurred while trying to send from alephium to ${coalesceChainName(chainId)}, error: ${e}`)
    throw e
  }
}

async function getCurrentMessageFee(chainId: ChainId): Promise<bigint> {
  const governanceAddress = getGovernanceAddress(config.networkId, chainId)
  const provider = newEVMProvider(getNodeUrl(config.networkId, chainId))
  const governance = ethers_contracts.Governance__factory.connect(governanceAddress, provider)
  const messageFee = await governance.messageFee()
  return messageFee.toBigInt()
}

async function transferFromEvmChainToAlph(chainId: ChainId, amount: bigint = ONE_ALPH) {
  try {
    const currentMessageFee = await getCurrentMessageFee(chainId)
    const evmTxOptions = {
      gasLimit: 5000000,
      gasPrice: 1000000,
      value: currentMessageFee + amount
    }
    const tokenBridgeAddress = getTokenBridgeAddress(config.networkId, chainId)
    const provider = newEVMProvider(getNodeUrl(config.networkId, chainId))
    const wallet = new ethers.Wallet(config.privateKeys[chainId]![0], provider)
    const recipientAddress = bs58.decode(alphWallet.address)
    const receipt = await transferFromEthNative(
      tokenBridgeAddress,
      wallet,
      amount,
      CHAIN_ID_ALEPHIUM,
      recipientAddress,
      undefined,
      evmTxOptions
    )
    // get the sequence from the logs (needed to fetch the vaa)
    sequence = parseSequenceFromLogEth(receipt, getGovernanceAddress(config.networkId, chainId))
    console.log(`Transfer token sequence: ${sequence}`)
    emitterAddress = encodeEmitterAddress(chainId, tokenBridgeAddress)
    // poll until the guardian(s) witness and sign the vaa
    const { vaaBytes: signedVAA } = await getSignedVAAWithRetry(
      devnetGuardianConfig.guardianUrls,
      chainId,
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
    console.error(`An error occurred while trying to send from ${coalesceChainName(chainId)} to alephium, error: ${e}`)
    throw e
  }
}

async function checkTransferCompletedOnEVM(chainId: ChainId, times: number = 5) {
  try {
    let success: boolean = false
    const tokenBridgeAddress = getTokenBridgeAddress(config.networkId, chainId)
    const provider = newEVMProvider(getNodeUrl(config.networkId, chainId))
    for (let count = 0; count < times && !success; ++count) {
      console.log(`Sleeping before querying spy relay, timestamp: ${new Date().toLocaleString()}`)
      await sleep(5000)
      success = await getIsTransferCompletedEth(
        tokenBridgeAddress,
        provider,
        transferSignedVAA
      )
      console.log(`Check transfer completed returned ${success}, count is ${count}`)
    }
    expect(success).toBe(true)
  } catch (e) {
    console.error(`An error occurred while trying to redeem on ${coalesceChainName(chainId)}, error: ${e}`)
    throw e
  }
}

async function checkTransferCompletedOnAlephium(times: number = 5) {
  try {
    const groupIndex = getAlephiumGroupIndex(config.networkId)
    const tokenBridgeForChainId = getTokenBridgeForChainId(alphTokenBridgeAddress, CHAIN_ID_ETH, groupIndex)
    let success: boolean = false
    for (let count = 0; count < 5 && !success; ++count) {
      console.log(`Sleeping before querying spy relay: timestamp: ${new Date().toLocaleString()}`)
      await sleep(5000)
      success = await getIsTransferCompletedAlph(
        tokenBridgeForChainId,
        groupIndex,
        transferSignedVAA
      )
      console.log(`Check transfer completed returned ${success}, count is ${count}`)
    }
    expect(success).toBe(true)
  } catch (e) {
    console.error(`An error occurred while trying to redeem on Alephium, error: ${e}`)
    throw e
  }
}

describe('Alephium to Ethereum', () => {
  test('Send Alephium token to Ethereum', async () => {
    await transferFromAlphToEvmChain(CHAIN_ID_ETH)
  })

  test('Spy Relay redeemed on Ethereum', async () => {
    await checkTransferCompletedOnEVM(CHAIN_ID_ETH)
  })
})

describe('Ethereum to Alephium', () => {
  test('Send ETH to Alephium', async () => {
    await transferFromEvmChainToAlph(CHAIN_ID_ETH)
  })

  test('Spy Relay redeemed on Alephium', async () => {
    await checkTransferCompletedOnAlephium()
  })
})

describe('Alephium to BSC', () => {
  test('Send Alephium token to BSC', async () => {
    await transferFromAlphToEvmChain(CHAIN_ID_BSC)
  })

  test('Spy Relay redeemed on BSC', async () => {
    await checkTransferCompletedOnEVM(CHAIN_ID_BSC)
  })
})

describe('BSC to Alephium', () => {
  test('Send BNB to Alephium', async () => {
    await transferFromEvmChainToAlph(CHAIN_ID_BSC)
  })

  test('Spy Relay redeemed on Alephium', async () => {
    await checkTransferCompletedOnAlephium()
  })
})

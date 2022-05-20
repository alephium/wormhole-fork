import {
  transferFromEth as transferTokenFromEth,
  approveEth,
  parseSequenceFromLogEth,
  parseSequenceFromLogAlph,
  getSignedVAA,
  CHAIN_ID_ETH,
  getEmitterAddressEth,
  CHAIN_ID_ALEPHIUM,
  redeemOnAlph as redeemTokenOnAlph,
  redeemOnEth as redeemTokenOnEth,
  ChainId,
  transferLocalTokenFromAlph,
  transferRemoteTokenFromAlph,
  completeUndoneSequence
} from '@certusone/wormhole-sdk'
import { Signer } from 'alephium-web3'
import { ethers } from 'ethers'
import { waitTxConfirmed } from '../lib/utils'
import { NodeHttpTransport } from "@improbable-eng/grpc-web-node-http-transport";
import * as env from './env'
import * as base58 from 'bs58'

const ethTokenBridgeAddress = '0x0290FB167208Af455bB137780163b7B7a9a10C16'
const alphBridgeContractId = 'bbec56f023153a4c7992ecdfe28c445c950fb797efd65b45365364af8ea3bb45'
const ethEventEmitterAddress = '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550'
const ethAccountPrivateKey = '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'
const wormholeRpcHost = 'http://localhost:7071'
const alphAccountAddress = '1DrDyTr9RpRsQnDnXo2YRiPzPW4ooHX5LLoqXrqfMrpQH'
const alphAccountId = base58.decode(alphAccountAddress).slice(1)

async function tryToGetSignedVAA(
  emitterChain: ChainId,
  emitterAddress: string,
  sequence: string,
  timeout: number = 60000 // 1 minute
) {
  let result
  let requestTimeout = false
  const task = setTimeout(() => requestTimeout = true, timeout)
  while (!result) {
    if (requestTimeout) {
      throw Error("fetch signed vaa timeout, emitter chain: " + emitterChain + ', emitter address: ' + emitterAddress + ', sequence: ' + sequence)
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      result = await getSignedVAA(
        wormholeRpcHost,
        emitterChain,
        emitterAddress,
        sequence,
        { transport: NodeHttpTransport()}
      );
    } catch (err) {
      console.log("get signed vaa error: " + err)
    }
  }
  clearTimeout(task)
  return result
}

// transfer token from eth to alephium
async function transferFromEth(
  provider: ethers.providers.Provider,
  tokenAddress: string,
  amount: number
) {
  const signer = new ethers.Wallet(ethAccountPrivateKey, provider)
  await approveEth(ethTokenBridgeAddress, tokenAddress, signer, amount)

  const transferReceipt = await transferTokenFromEth(ethTokenBridgeAddress, signer, tokenAddress, amount, CHAIN_ID_ALEPHIUM, alphAccountId)
  const sequence = parseSequenceFromLogEth(transferReceipt, ethEventEmitterAddress)
  console.log("transfer token from eth tx id: " + transferReceipt.transactionHash + ', sequence: ' + sequence)

  const emitterAddress = getEmitterAddressEth(ethTokenBridgeAddress)
  const response = await tryToGetSignedVAA(CHAIN_ID_ETH, emitterAddress, sequence)
  return response.vaaBytes
}

// redeem on alephium
async function redeemOnAlph(
  signer: Signer,
  toAddress: string,
  signedVAA: Uint8Array,
  tokenWrapperId: string
) {
  console.log("redeem on alephium signed vaa: " + Buffer.from(signedVAA).toString('hex'))
  const bytecode = redeemTokenOnAlph(tokenWrapperId, signedVAA, toAddress)
  const tx = await signer.signScriptTx({
    signerAddress: toAddress,
    bytecode: bytecode,
    submitTx: true
  })
  const confirmed = await waitTxConfirmed(signer.client, tx.txId)
  console.log("redeem tx confirmed, tx id: " + tx.txId + ', block hash: ' + confirmed.blockHash)
}

// transfer token from alephium to eth
async function transferFromAlph(
  signer: Signer,
  senderAddress: string,
  tokenWrapperId: string,
  localTokenId: string | undefined,
  isLocalToken: boolean,
  amount: number,
  toAddress: string
) {
  let bytecode: string
  if (isLocalToken) {
    bytecode = transferLocalTokenFromAlph(
      tokenWrapperId,
      senderAddress,
      localTokenId!,
      toAddress,
      BigInt(amount),
      env.messageFee,
      BigInt(0),
      0
    )
  } else {
    bytecode = transferRemoteTokenFromAlph(
      tokenWrapperId,
      senderAddress,
      toAddress,
      BigInt(amount),
      env.messageFee,
      BigInt(0),
      0
    )
  }
  const tx = await signer.signScriptTx({
    signerAddress: senderAddress,
    bytecode: bytecode,
    submitTx: true
  })
  const confirmed = await waitTxConfirmed(signer.client, tx.txId)
  console.log("transfer token from alephium tx id: " + tx.txId + ', block hash: ' + confirmed.blockHash)
  const sequence = await parseSequenceFromLogAlph(signer.client, tx.txId, alphBridgeContractId)

  const response = await tryToGetSignedVAA(CHAIN_ID_ALEPHIUM, alphBridgeContractId, sequence)
  return response.vaaBytes
}

// redeem on eth
async function redeemOnEth(provider: ethers.providers.Provider, signedVAA: Uint8Array) {
  console.log("redeem on eth signed vaa: " + Buffer.from(signedVAA).toString('hex'))
  const signer = new ethers.Wallet(ethAccountPrivateKey, provider)
  const redeemReceipt = await redeemTokenOnEth(ethTokenBridgeAddress, signer, signedVAA)
  console.log("redeem on eth tx confirmed, tx id: " + redeemReceipt.transactionHash)
}

// complete undone transfer
async function completeUndoneTransfer(signer: Signer, sequence: number) {
  const response = await tryToGetSignedVAA(env.governanceChainId, env.governanceContractAddress, sequence.toString())
  console.log("undone transfer governance vaa: " + Buffer.from(response.vaaBytes).toString('hex'))
  const bytecode = completeUndoneSequence(alphBridgeContractId, response.vaaBytes, alphAccountAddress)
  const tx = await signer.signScriptTx({
    signerAddress: alphAccountAddress,
    bytecode: bytecode,
    submitTx: true
  })
  const confirmed = await waitTxConfirmed(signer.client, tx.txId)
  console.log("complete undone transfer tx confirmed, tx id: " + tx.txId + ', block hash: ' + confirmed.blockHash)
}

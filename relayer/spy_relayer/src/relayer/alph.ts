import {
  ChainId,
  getIsTransferCompletedAlph,
  getTokenBridgeForChainId,
  hexToUint8Array,
  redeemOnAlph
} from "alephium-wormhole-sdk";
import { PrivateKeyWallet } from "@alephium/web3-wallet"
import { AlephiumChainConfigInfo } from "../configureEnv";
import { getScopedLogger, ScopedLogger } from "../helpers/logHelper";
import { PromHelper } from "../helpers/promHelpers";
import { node, NodeProvider } from '@alephium/web3'

export async function relayAlph(
  emitterChainId: ChainId,
  chainConfigInfo: AlephiumChainConfigInfo,
  signedVAA: string,
  checkOnly: boolean,
  privateKey: string,
  relayLogger: ScopedLogger,
  metrics: PromHelper
) {
  const logger = getScopedLogger(["alph"], relayLogger)

  // we have validated the `groupIndex` at initialization
  const groupIndex = chainConfigInfo.groupIndex!
  const signer = new PrivateKeyWallet({privateKey})
  const signedVaaArray = hexToUint8Array(signedVAA)

  logger.debug('Checking to see if vaa has already been redeemed.')
  const tokenBridgeForChainId = getTokenBridgeForChainId(chainConfigInfo.tokenBridgeAddress, emitterChainId, chainConfigInfo.groupIndex)
  const alreadyRedeemed = await getIsTransferCompletedAlph(
    tokenBridgeForChainId,
    groupIndex,
    signedVaaArray
  )

  if (alreadyRedeemed) {
    logger.info('VAA has already been redeemed!')
    return { redeemed: true, result: 'already redeemed' }
  }
  if (checkOnly) {
    return { redeemed: false, result: 'not redeemed' }
  }

  logger.info(`Will redeem using pubkey: ${(await signer.getSelectedAccount()).address}`)

  logger.debug('Redeeming...')
  const redeemResult = await redeemOnAlph(signer, chainConfigInfo.bridgeRewardRouter, tokenBridgeForChainId, signedVaaArray)
  const confirmed = await waitAlphTxConfirmed(signer.nodeProvider, redeemResult.txId, 1, 120)
  const executionOk = await getScriptExecutionResult(signer.nodeProvider, confirmed)
  logger.info(`Redeem transaction tx id: ${redeemResult.txId}, script execution result: ${executionOk}`)

  if (executionOk) {
    metrics.incSuccesses(chainConfigInfo.chainId)
    return { redeemed: true, result: `${redeemResult.txId} executed successfully` }
  } else {
    metrics.incFailures(chainConfigInfo.chainId)
    return { redeemed: executionOk, result: `${redeemResult.txId} execution failed` }
  }
}

async function getScriptExecutionResult(nodeProvider: NodeProvider, confirmed: node.Confirmed) {
  const block = await nodeProvider.blockflow.getBlockflowBlocksBlockHash(confirmed.blockHash)
  return block.transactions[confirmed.txIndex].scriptExecutionOk
}

function isConfirmed(txStatus: node.TxStatus): txStatus is node.Confirmed {
  return txStatus.type === 'Confirmed'
}

export async function waitAlphTxConfirmed(
  provider: NodeProvider,
  txId: string,
  confirmations: number,
  timeout: number // seconds
): Promise<node.Confirmed> {
  if (timeout <= 0) {
    throw new Error(`Wait tx confirmed timeout, txId: ${txId}`)
  }
  const status = await provider.transactions.getTransactionsStatus({ txId: txId })
  if (isConfirmed(status) && status.chainConfirmations >= confirmations) {
    return status
  }
  await new Promise((r) => setTimeout(r, 10000))
  return waitAlphTxConfirmed(provider, txId, confirmations, timeout - 10)
}

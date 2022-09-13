import { NodeProvider, node, contractIdFromAddress, binToHex } from '@alephium/web3'
import { randomBytes } from 'crypto'

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => {
    return b.toString(16).padStart(2, '0')
  }).join('')
}

export function nonce(): string {
  const bytes = randomBytes(4)
  return toHex(bytes)
}

export function zeroPad(value: string, byteLength: number): string {
  const expectedLength = 2 * byteLength
  if (value.length < expectedLength) {
    const prefix = Array(expectedLength - value.length)
      .fill('0')
      .join('')
    return prefix + value
  }
  return value
}

function isConfirmed(txStatus: node.TxStatus): txStatus is node.Confirmed {
  return txStatus.type === 'Confirmed'
}

export async function waitTxConfirmed(
  provider: NodeProvider,
  txId: string,
  confirmations: number
): Promise<node.Confirmed> {
  const status = await provider.transactions.getTransactionsStatus({ txId: txId })
  if (isConfirmed(status) && status.chainConfirmations >= confirmations) {
    return status
  }
  await new Promise((r) => setTimeout(r, 1000))
  return waitTxConfirmed(provider, txId, confirmations)
}

export async function getCreatedContractId(
  provider: NodeProvider,
  blockHash: string,
  txId: string,
  outputIndex = 0
): Promise<string> {
  const block = await provider.blockflow.getBlockflowBlocksBlockHash(blockHash)
  const tx = block.transactions.find((t) => t.unsigned.txId === txId)
  if (tx === undefined) {
    throw new Error(`No transaction ${txId} in block ${blockHash}`)
  }
  const address = tx.generatedOutputs[outputIndex].address
  return binToHex(contractIdFromAddress(address))
}

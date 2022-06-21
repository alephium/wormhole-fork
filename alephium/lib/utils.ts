import { NodeProvider, node } from '@alephium/web3'
import { randomBytes } from 'crypto'
import * as base58 from 'bs58'

export function toHex(bytes: Uint8Array): string {
    return Array.from(bytes, b => {
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
        const prefix = Array(expectedLength - value.length).fill('0').join("")
        return prefix + value
    }
    return value
}

function isConfirmed(txStatus: node.TxStatus): txStatus is node.Confirmed {
    return (txStatus as node.Confirmed).blockHash !== undefined
}

export async function waitTxConfirmed(provider: NodeProvider, txId: string): Promise<node.Confirmed> {
    const status = await provider.transactions.getTransactionsStatus({txId: txId})
    if (!isConfirmed(status)) {
        await new Promise(r => setTimeout(r, 10000))
        return waitTxConfirmed(provider, txId)
    }
    return status as node.Confirmed;
}

export function toContractAddress(contractId: string): string {
    const bytes = Buffer.from('03' + contractId, 'hex')
    return base58.encode(bytes)
}

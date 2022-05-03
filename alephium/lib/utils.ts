import { CliqueClient } from 'alephium-web3'
import { Confirmed, TxStatus } from 'alephium-web3/api/alephium'
import { randomBytes } from 'crypto'

export function toHex(bytes: Uint8Array): string {
    return Array.from(bytes, b => {
        return b.toString(16).padStart(2, '0')
    }).join('')
}

export function nonce(): string {
    const bytes = randomBytes(4)
    return toHex(bytes)
}

export function zeroPad(value: string, length: number): string {
    const expectedLength = 2 * length
    if (value.length < expectedLength) {
        const prefix = Array(expectedLength - value.length).fill('0').join("")
        return prefix + value
    }
    return value
}

function isConfirmed(txStatus: TxStatus): txStatus is Confirmed {
    return (txStatus as Confirmed).blockHash !== undefined
}

export async function waitTxConfirmed(client: CliqueClient, txId: string): Promise<Confirmed> {
    const status = await client.transactions.getTransactionsStatus({txId: txId})
    if (!isConfirmed(status.data)) {
        await new Promise(r => setTimeout(r, 10000))
        return waitTxConfirmed(client, txId)
    }
    return status.data as Confirmed;
}

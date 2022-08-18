import { NodeProvider, node, Contract, Script } from '@alephium/web3'
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

// TODO: remove after this PR merged: https://github.com/alephium/alephium-web3/pull/21
async function ignoreUnusedConstantsWarnings<T extends Contract | Script>(
    compile: () => Promise<T>,
    recover: () => Promise<T>
): Promise<T> {
    try {
        return await compile()
    } catch (error) {
        if (!(error instanceof Error)) {
            throw error
        }
        if (!error.message.startsWith("Compilation warnings")) {
            throw error
        }
        if (error.message.includes("unused variables") || error.message.includes("unused fields")) {
            throw error
        }
        return await recover()
    }
}

export async function compileContract(provider: NodeProvider, path: string): Promise<Contract> {
    return ignoreUnusedConstantsWarnings(
        () => Contract.fromSource(provider, path),
        () => Contract.fromSource(provider, path, false)
    )
}

export async function compileScript(provider: NodeProvider, path: string): Promise<Script> {
    return ignoreUnusedConstantsWarnings(
        () => Script.fromSource(provider, path),
        () => Script.fromSource(provider, path, false)
    )
}

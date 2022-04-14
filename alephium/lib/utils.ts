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

export function zeroPad(value: string, length: number) {
    const expectedLength = 2 * length
    if (value.length < expectedLength) {
        const prefix = Array(expectedLength - value.length).fill('0').join("")
        return prefix + value
    }
    return value
}

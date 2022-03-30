const oneByteBound = 0x40
const twoByteBound = oneByteBound << 8
const fourByteBound = oneByteBound << (8 * 3)

const bigIntZero = BigInt(0)

const oneBytePrefix = 0x00
const twoBytePrefix = 0x40
const fourBytePrefix = 0x80
const multiBytePrefix = 0xc0

function encodeU32(num: number): Uint8Array {
    if (num < oneByteBound) {
        return new Uint8Array([num + oneBytePrefix])
    }

    if (num < twoByteBound) {
        return new Uint8Array([((num >> 8) & 0xff) + twoBytePrefix, num & 0xff])
    }

    return new Uint8Array([
        ((num >> 24) & 0xff) + fourBytePrefix,
        ((num >> 16) & 0xff),
        ((num >> 8) & 0xff),
        num & 0xff
    ])
}

export function encodeU256(num: BigInt): Uint8Array {
    if (num < bigIntZero) {
        throw Error(num + ' less than 0')
    }

    if (num < BigInt(fourByteBound)) {
        return encodeU32(Number(num))
    }

    let hex = num.toString(16)
    if (hex.length % 2 === 1) {
        hex = '0' + hex
    }

    let byteLength = hex.length / 2
    const bytes = new Uint8Array(byteLength)
    let index = 0
    while (index < byteLength) {
        const offset = index * 2
        bytes[index] = parseInt(hex.slice(offset, offset + 2), 16)
        index += 1
    }

    const header = (byteLength - 4) + multiBytePrefix
    return new Uint8Array([header, ...bytes])
}

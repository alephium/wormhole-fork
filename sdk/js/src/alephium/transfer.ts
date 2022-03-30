import * as base58 from 'bs58'
import { encodePositiveInt, encodeU256 } from './serde'

function toHex(bytes: Uint8Array): string {
    return Array.from(bytes, b => {
        return b.toString(16).padStart(2, '0')
    }).join('')
}

function encodeAddress(address: string): string {
    return toHex(base58.decode(address))
}

function getTokenId(tokenId: string): string {
    if (tokenId.length == 64) {
        return tokenId
    }
    return toHex(base58.decode(tokenId).slice(1))
}

function getContractId(address: string): string {
    return toHex(base58.decode(address).slice(1))
}

function encodeConsistencyLevel(num: number): string {
    if (num < 0) {
        throw Error('invalid consistencyLevel')
    }

    const u256Const0Instr = 0x0c
    if (num <= 5) {
        const instr = u256Const0Instr + num
        return instr.toString(16).padStart(2, '0')
    }

    return '13' + toHex(encodeU256(BigInt(num)))
}

export function transferNativeCode(
    tokenBridgeForChainAddress: string,
    sender: string,
    tokenId: string,
    toAddress: string,
    tokenAmount: bigint,
    messageFee: bigint,
    arbiterFee: bigint,
    nonce: string,
    consistencyLevel: number
): string {
    if (toAddress.length != 64) {
        throw Error('invalid toAddress')
    }

    if (nonce.length != 8) {
        throw Error('invalid nonce')
    }

    return "010101000400" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "18" + // instrLen
        "15" + // addressConstInstr
        encodeAddress(sender) +
        "1700" + // storeLocal(0)
        "14" + // bytesConstInstr
        "4020" + // 32 bytes prefix
        getTokenId(tokenId) + // tokenId
        "1701" + // storeLocal(1)
        "13" + // u256ConstInstr
        toHex(encodeU256(tokenAmount)) + // tokenAmount
        "1702" + // storeLocal(2)
        "1600" + // loadLocal(0)
        "13" + // u256ConstInstr
        toHex(encodeU256(messageFee)) +
        "a2" + // approveAlph
        "1600" + // loadLocal(0)
        "1601" + // loadLocal(1)
        "1602" + // loadLocal(2)
        "a3" + // approveToken
        "14" + // bytesConstInstr
        "4020" + // 32 bytes prefix
        getContractId(tokenBridgeForChainAddress) +
        "1703" + // storeLocal(3)
        "1601" + // loadLocal(1)
        "1600" + // loadLocal(0)
        "14" + // bytesConstInstr
        "4020" + // 32 bytes prefix
        toAddress +
        "1602" + // loadLocal(2)
        "13" + // u256ConstInstr
        toHex(encodeU256(arbiterFee)) +
        "14" + // bytesConstInstr
        "04" + // nonceLen
        nonce +
        encodeConsistencyLevel(consistencyLevel) +
        "1603" + // localLocal(3)
        "0105" // callExternal(5)
}

export function completeTransferNativeCode(
    tokenBridgeForChainAddress: string,
    vaa: string,
    arbiter: string
): string {
    return "010101000100" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "06" + // instrLen
        "14" + // bytesConstInstr
        "4020" + // 32 bytes prefix
        getContractId(tokenBridgeForChainAddress) +
        "1700" + // storeLocal(0)
        "14" + // bytesConstInstr
        toHex(encodePositiveInt(vaa.length / 2)) + // prefix
        vaa +
        "15" + // addressConstInstr
        encodeAddress(arbiter) +
        "1600" + // loadLocal(0)
        "0108" // callExternal(8)
}

export function transferWrappedCode(
    tokenWrapperAddress: string,
    sender: string,
    toAddress: string,
    tokenAmount: bigint,
    messageFee: bigint,
    arbiterFee: bigint,
    nonce: string,
    consistencyLevel: number
): string {
    if (toAddress.length != 64) {
        throw Error('invalid toAddress')
    }

    if (nonce.length != 8) {
        throw Error('invalid nonce')
    }

    return "010101000400" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "17" + // instrLen
        "15" + // addressConstInstr
        encodeAddress(sender) +
        "1700" + // storeLocal(0)
        "14" + // bytesConstInstr
        "4020" + // 32 bytes prefix
        getContractId(tokenWrapperAddress) +
        "1701" + // storeLocal(1)
        "13" + // u256ConstInstr
        toHex(encodeU256(tokenAmount)) +
        "1702" + // storeLocal(2)
        "1600" + // loadLocal(1)
        "13" + // u256ConstInstr
        toHex(encodeU256(messageFee)) +
        "a2" + // approveAlph
        "1600" + // loadLocal(0)
        "1601" + // loadLocal(1)
        "1602" + // loadLocal(2)
        "a3" + // approveToken
        "1601" + // loadLocal(1)
        "1703" + // storeLocal(3)
        "1600" + // loadLocal(0)
        "14" + // bytesConstInstr
        "4020" + // 32 bytes prefix
        toAddress +
        "1602" + // loadLocal(2)
        "13" + // u256ConstInstr
        toHex(encodeU256(arbiterFee)) +
        "14" + // bytesConstInstr
        "04" + // nonceLen
        nonce +
        encodeConsistencyLevel(consistencyLevel) +
        "1603" + // loadLocal(3)
        "0100" // callExternal(0)
}

export function completeTransferWrappedCode(
    tokenWrapperAddress: string,
    vaa: string,
    arbiter: string
): string {
    return "010101000100" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "06" + // instrLen
        "14" + // bytesConstInstr
        "4020" + // 32 bytes prefix
        getContractId(tokenWrapperAddress) +
        "1700" + // storeLocal(0)
        "14" + // bytesConstInstr
        toHex(encodePositiveInt(vaa.length / 2)) +
        vaa +
        "15" + // addressConstInstr
        encodeAddress(arbiter) +
        "1600" + // loadLocal(0)
        "0101" // callExternal(1)
}

import * as base58 from 'bs58'
import { toHex } from '../utils/hex'
import { encodePositiveInt, encodeU256 } from './serde'

const approveAlph = 'a2'
const approveToken = 'a3'

function encodeAddress(address: string): string {
    // addressConstInstr + addressBytes
    return '15' + toHex(base58.decode(address))
}

function encodeContractId(tokenId: string): string {
    // bytesConstInstr + 32 bytes prefix
    const prefix = '14' + '4020'
    if (tokenId.length == 64) {
        return prefix + tokenId
    }
    return prefix + toHex(base58.decode(tokenId).slice(1))
}

function storeLocal(index: number): string {
    if (index > 255) {
        throw Error('invalid variable index: ' + index)
    }
    // storeLocalInstr + index
    return '17' + index.toString(16).padStart(2, '0')
}

function loadLocal(index: number): string {
    if (index > 255) {
        throw Error('invalid variable index: ' + index)
    }
    // loadLocalInstr + index
    return '16' + index.toString(16).padStart(2, '0')
}

function u256(num: bigint): string {
    return '13' + toHex(encodeU256(num))
}

function encodeBytes(hex: string): string {
    const length = hex.length / 2
    return '14' + toHex(encodePositiveInt(length)) + hex
}

function callExternal(index: number): string {
    if (index > 255) {
        throw Error('invalid method index: ' + index)
    }
    return '01' + index.toString(16).padStart(2, '0')
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
        throw Error('invalid toAddress: ' + toAddress)
    }

    if (nonce.length != 8) {
        throw Error('invalid nonce: ' + nonce)
    }

    return "010101000400" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "18" + // instrLen
        encodeAddress(sender) +
        storeLocal(0) +
        encodeContractId(tokenId) +
        storeLocal(1) +
        u256(tokenAmount) +
        storeLocal(2) +
        loadLocal(0) +
        u256(messageFee) +
        approveAlph +
        loadLocal(0) +
        loadLocal(1) +
        loadLocal(2) +
        approveToken +
        encodeContractId(tokenBridgeForChainAddress) +
        storeLocal(3) +
        loadLocal(1) +
        loadLocal(0) +
        encodeBytes(toAddress) +
        loadLocal(2) +
        u256(arbiterFee) +
        encodeBytes(nonce) +
        encodeConsistencyLevel(consistencyLevel) +
        loadLocal(3) +
        callExternal(5)
}

export function completeTransferNativeCode(
    tokenBridgeForChainAddress: string,
    vaa: string,
    arbiter: string
): string {
    return "010101000100" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "06" + // instrLen
        encodeContractId(tokenBridgeForChainAddress) +
        storeLocal(0) +
        encodeBytes(vaa) +
        encodeAddress(arbiter) +
        loadLocal(0) +
        callExternal(8)
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
        throw Error('invalid toAddress: ' + toAddress)
    }

    if (nonce.length != 8) {
        throw Error('invalid nonce: ' + nonce)
    }

    return "010101000400" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "17" + // instrLen
        encodeAddress(sender) +
        storeLocal(0) +
        encodeContractId(tokenWrapperAddress) +
        storeLocal(1) +
        u256(tokenAmount) +
        storeLocal(2) +
        loadLocal(0) +
        u256(messageFee) +
        approveAlph +
        loadLocal(0) +
        loadLocal(1) +
        loadLocal(2) +
        approveToken +
        loadLocal(1) +
        storeLocal(3) +
        loadLocal(0) +
        encodeBytes(toAddress) +
        loadLocal(2) +
        u256(arbiterFee) +
        encodeBytes(nonce) +
        encodeConsistencyLevel(consistencyLevel) +
        loadLocal(3) +
        callExternal(0)
}

export function completeTransferWrappedCode(
    tokenWrapperAddress: string,
    vaa: string,
    arbiter: string
): string {
    return "010101000100" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "06" + // instrLen
        encodeContractId(tokenWrapperAddress) +
        storeLocal(0) +
        encodeBytes(vaa) +
        encodeAddress(arbiter) +
        loadLocal(0) +
        callExternal(1)
}

export function attestTokenCode(
    tokenBridgeAddress: string,
    tokenId: string,
    payer: string,
    messageFee: bigint,
    nonce: string,
    consistencyLevel: number
): string {
    if (nonce.length != 8) {
        throw Error('invalid nonce: ' + nonce)
    }

    return "010101000200" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "0d" + // instrLen
        encodeAddress(payer) +
        storeLocal(0) +
        loadLocal(0) +
        u256(messageFee) +
        approveAlph +
        encodeContractId(tokenBridgeAddress) +
        storeLocal(1) +
        loadLocal(0) +
        encodeContractId(tokenId) +
        encodeBytes(nonce) +
        encodeConsistencyLevel(consistencyLevel) +
        loadLocal(1) +
        callExternal(8)
}

export function createWrappedCode(
    tokenBridgeForChainAddress: string,
    vaa: string,
    payer: string,
    alphAmount: bigint
): string {
    return "010101000100" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "07" + // instrLen
        encodeContractId(tokenBridgeForChainAddress) +
        storeLocal(0) +
        encodeBytes(vaa) +
        encodeAddress(payer) +
        u256(alphAmount) +
        loadLocal(0) +
        callExternal(4)
}

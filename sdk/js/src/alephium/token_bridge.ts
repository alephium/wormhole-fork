import * as base58 from 'bs58'
import { encode } from 'bs58'
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

export function transferLocalTokenCode(
    tokenWrapperAddress: string,
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

    return "010101000300" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "15" + // instrLen
        encodeAddress(sender) +
        storeLocal(0) +
        u256(tokenAmount) +
        storeLocal(1) +
        loadLocal(0) +
        u256(messageFee) +
        approveAlph +
        loadLocal(0) +
        encodeContractId(tokenId) +
        loadLocal(1) +
        approveToken +
        encodeContractId(tokenWrapperAddress) +
        storeLocal(2) +
        loadLocal(0) +
        encodeBytes(toAddress) +
        loadLocal(1) +
        u256(arbiterFee) +
        encodeBytes(nonce) +
        encodeConsistencyLevel(consistencyLevel) +
        loadLocal(2) +
        callExternal(2)
}

export function completeTransfer(
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
        callExternal(3)
}

export function transferRemoteTokenCode(
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
        u256(tokenAmount) +
        storeLocal(1) +
        encodeContractId(tokenWrapperAddress) +
        storeLocal(2) +
        loadLocal(0) +
        u256(messageFee) +
        approveAlph +
        loadLocal(0) +
        loadLocal(2) +
        loadLocal(1) +
        approveToken +
        loadLocal(2) +
        storeLocal(3) +
        loadLocal(0) +
        encodeBytes(toAddress) +
        loadLocal(1) +
        u256(arbiterFee) +
        encodeBytes(nonce) +
        encodeConsistencyLevel(consistencyLevel) +
        loadLocal(3) +
        callExternal(2)
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

export function createLocalTokenWrapperCode(
    tokenBridgeForChainAddress: string,
    localTokenId: string,
    payer: string,
    alphAmount: bigint
): string {
    return "010101000300" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "0e" + // instrLen
        encodeAddress(payer) +
        storeLocal(0) +
        u256(alphAmount) +
        storeLocal(1) +
        loadLocal(0) +
        loadLocal(1) +
        approveAlph +
        encodeContractId(tokenBridgeForChainAddress) +
        storeLocal(2) +
        encodeContractId(localTokenId) +
        loadLocal(0) +
        loadLocal(1) +
        loadLocal(2) +
        callExternal(4)
}

export function createRemoteTokenWrapperCode(
    tokenBridgeForChainAddress: string,
    vaa: string,
    payer: string,
    alphAmount: bigint
): string {
    return "010101000300" + // methodLength + public + payable + argLen + localVarLen + returnLen
        "0e" + // instrLen
        encodeAddress(payer) +
        storeLocal(0) +
        u256(alphAmount) +
        storeLocal(1) +
        loadLocal(0) +
        loadLocal(1) +
        approveAlph +
        encodeContractId(tokenBridgeForChainAddress) +
        storeLocal(2) +
        encodeBytes(vaa) +
        loadLocal(0) +
        loadLocal(1) +
        loadLocal(2) +
        callExternal(5)
}

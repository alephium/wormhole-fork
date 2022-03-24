// generate devnet vaa which register chain A to chain B
import * as elliptic from 'elliptic'
import { toHex, zeroPad } from '../lib/utils'
import { governanceChainId, governanceContractAddress } from './env'
import * as base58 from 'bs58'
import Web3 from 'web3'

// message is hex string
function sign(privateKey: string, message: string): string {
    const ec = new elliptic.ec('secp256k1')
    const key = ec.keyFromPrivate(privateKey)
    const sig = key.sign(message, {canonical: true})
    const signature = [
        zeroPad(sig.r.toString(16), 32),
        zeroPad(sig.s.toString(16), 32),
        zeroPad((sig.recoveryParam as number).toString(16), 1)
    ].join("")
    return signature
}

function registerTo(sourceChainId: number, targetChainId: number, tokenBridgeAddress: string): string {
    const tokenBridgeModule = '000000000000000000000000000000000000000000546f6b656e427269646765'
    const privateKey = "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0"
    const actionId = 1
    let registerChain = Buffer.allocUnsafe(69)
    registerChain.write(tokenBridgeModule, 0, 'hex')
    registerChain.writeUint8(actionId, 32)
    registerChain.writeUint16BE(0, 33) // ignore target chain
    registerChain.writeUint16BE(sourceChainId, 35)
    registerChain.write(tokenBridgeAddress, 37, 'hex')

    const nonce = '00000001'
    const timestamp = 1
    const sequence = 0
    const consistencyLevel = 0
    let bodyHeader = Buffer.allocUnsafe(51)
    bodyHeader.writeUint32BE(timestamp, 0)
    bodyHeader.write(nonce, 4, 'hex')
    bodyHeader.writeUint16BE(governanceChainId, 8)
    bodyHeader.write(governanceContractAddress, 10, 'hex')
    bodyHeader.writeBigUint64BE(BigInt(sequence), 42)
    bodyHeader.writeUint8(consistencyLevel, 50)

    const web3 = new Web3()
    let body = Buffer.concat([bodyHeader, registerChain])
    let hash = web3.utils.keccak256(web3.utils.keccak256('0x' + body.toString('hex')))
    let signature = sign(privateKey, hash.slice(2))
    const version = 1
    const guardianSetIndex = 0
    let vaaHeader = Buffer.allocUnsafe(72)
    vaaHeader.writeUint8(version, 0)
    vaaHeader.writeUint32BE(guardianSetIndex, 1)
    // only one signature
    vaaHeader.writeUint8(1, 5) // signatureSize
    vaaHeader.writeUint8(0, 6) // signatureIndex
    vaaHeader.write(signature, 7, 'hex')

    return Buffer.concat([vaaHeader, body]).toString('hex')
}

if (process.argv.length != 5) {
    console.log('Usage: node dist/devnet/gen_register_vaa.js SOURCE_CHAIN_ID TARGET_CHAIN_ID TOKEN_BRIDGE_ADDRESS')
    process.exit(1)
}

const sourceChainId = parseInt(process.argv[2])
const targetChainId = parseInt(process.argv[3])
let tokenBridgeAddress: string = process.argv[4]
if (tokenBridgeAddress.length != 64) { // alph contract address
    tokenBridgeAddress = toHex(base58.decode(tokenBridgeAddress).slice(1))
}

console.log(registerTo(sourceChainId, targetChainId, tokenBridgeAddress))

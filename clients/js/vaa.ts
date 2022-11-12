import { Parser } from "binary-parser"
import { ethers } from "ethers"
import { solidityKeccak256 } from "ethers/lib/utils"
import * as elliptic from "elliptic"
import { ChainId, CHAIN_ID_ALEPHIUM } from "alephium-wormhole-sdk"
import {
    AlphTokenBridgeExtensions,
    alphTokenBridgeExtensionsParser,
    serialiseAlphTokenBridgeExtensions
} from './alph'
import { P } from './parser'

type Modules = 'Core' | 'TokenBridge' | 'NFTBridge'

export interface Signature {
    guardianSetIndex: number
    signature: string
}

export interface VAA<T> {
    version: number
    guardianSetIndex: number
    signatures: Signature[]
    timestamp: number
    nonce: number
    emitterChain: number
    targetChain: number
    emitterAddress: string
    sequence: bigint
    consistencyLevel: number
    payload: T
}

// All the different types of payloads
export type Payload =
    GuardianSetUpgrade
    | UpdateMessageFee
    | TransferFee
    | CoreContractUpgrade
    | AlphContractUpgrade<'Core'>
    | AlphContractUpgrade<'TokenBridge'>
    | PortalContractUpgrade<"TokenBridge">
    | PortalContractUpgrade<"NFTBridge">
    | PortalRegisterChain<"TokenBridge">
    | PortalRegisterChain<"NFTBridge">
    | GovernanceExtension<typeof CHAIN_ID_ALEPHIUM, 'TokenBridge', AlphTokenBridgeExtensions>
// TODO: add other types of payloads

export function contractUpgradeVAA(
    module: 'Core' | 'TokenBridge' | 'NFTBridge',
    address: Uint8Array
): CoreContractUpgrade | PortalContractUpgrade<'TokenBridge'> | PortalContractUpgrade<'NFTBridge'> {
    return {
        module: module,
        type: 'ContractUpgrade',
        address: address
    }
}

export function parse(buffer: Buffer): VAA<Payload | null> {
    const vaa = parseEnvelope(buffer)
    const parser = guardianSetUpgradeParser
        .or(updateMessageFeeParser)
        .or(transferFeeParser)
        .or(coreContractUpgradeParser)
        .or(alphContractUpgradeParser('Core'))
        .or(alphContractUpgradeParser('TokenBridge'))
        .or(portalContractUpgradeParser("TokenBridge"))
        .or(portalContractUpgradeParser("NFTBridge"))
        .or(portalRegisterChainParser("TokenBridge"))
        .or(portalRegisterChainParser("NFTBridge"))
        .or(governanceExtensionParser(CHAIN_ID_ALEPHIUM, 'TokenBridge', alphTokenBridgeExtensionsParser))
    const payload = parser.parse(vaa.payload)
    var myVAA = { ...vaa, payload }

    return myVAA
}

export function hasPayload(vaa: VAA<Payload | null>): vaa is VAA<Payload> {
    return vaa.payload !== null
}

// Parse the VAA envelope without looking into the payload.
// If you want to parse the payload as well, use 'parse'.
export function parseEnvelope(buffer: Buffer): VAA<Buffer> {
    var vaa = vaaParser.parse(buffer)
    delete vaa['end']
    delete vaa['signatureCount']
    vaa.payload = Buffer.from(vaa.payload)
    return vaa
}

// Parse a signature
const signatureParser = new Parser()
    .endianess("big")
    .uint8("guardianSetIndex")
    .array("signature", {
        type: "uint8",
        lengthInBytes: 65,
        formatter: arr => Buffer.from(arr).toString("hex")
    })

function serialiseSignature(sig: Signature): string {
    const body = [
        encode("uint8", sig.guardianSetIndex),
        sig.signature
    ]
    return body.join("")
}

// Parse a vaa envelope. The payload is returned as a byte array.
const vaaParser = new Parser()
    .endianess("big")
    .uint8("version")
    .uint32("guardianSetIndex")
    .uint8("signatureCount")
    .array("signatures", {
        type: signatureParser,
        length: "signatureCount"
    })
    .uint32("timestamp")
    .uint32("nonce")
    .uint16("emitterChain")
    .uint16("targetChain")
    .array("emitterAddress", {
        type: "uint8",
        lengthInBytes: 32,
        formatter: arr => Buffer.from(arr).toString("hex")
    })
    .uint64("sequence")
    .uint8("consistencyLevel")
    .array("payload", {
        type: "uint8",
        readUntil: "eof"
    })
    .string("end", {
        greedy: true,
        assert: str => str === ""
    })

export function serialiseVAA(vaa: VAA<Payload>) {
    const body = [
        encode("uint8", vaa.version),
        encode("uint32", vaa.guardianSetIndex),
        encode("uint8", vaa.signatures.length),
        ...(vaa.signatures.map((sig) => serialiseSignature(sig))),
        vaaBody(vaa)
    ]
    return body.join("")
}

function vaaBody(vaa: VAA<Payload>) {
    let payload = vaa.payload
    let payload_str: string
    switch (payload.module) {
        case "Core":
            switch (payload.type) {
                case "GuardianSetUpgrade":
                    payload_str = serialiseGuardianSetUpgrade(payload)
                    break
                case 'UpdateMessageFee':
                    payload_str = serialiseUpdateMessageFee(payload)
                    break
                case 'TransferFee':
                    payload_str = serialiseTransferFee(payload)
                    break
                case "ContractUpgrade":
                    if ('code' in payload) {
                        payload_str = serialiseAlphContractUpgrade(payload)
                    } else {
                        payload_str = serialiseCoreContractUpgrade(payload)
                    }
                    break
            }
            break
        case "NFTBridge":
        case "TokenBridge":
            switch (payload.type) {
                case "ContractUpgrade":
                    if ('code' in payload) {
                        payload_str = serialiseAlphContractUpgrade(payload)
                    } else {
                        payload_str = serialisePortalContractUpgrade(payload)
                    }
                    break
                case "RegisterChain":
                    payload_str = serialisePortalRegisterChain(payload)
                    break
                case 'Extension':
                    if (payload.chainId === CHAIN_ID_ALEPHIUM && payload.module === 'TokenBridge') {
                        payload_str = serialiseGovernanceExtension(payload, serialiseAlphTokenBridgeExtensions)
                    }
                    break
            }
            break
    }
    const body = [
        encode("uint32", vaa.timestamp),
        encode("uint32", vaa.nonce),
        encode("uint16", vaa.emitterChain),
        encode("uint16", vaa.targetChain),
        encode("bytes32", Buffer.from(vaa.emitterAddress, "hex")),
        encode("uint64", vaa.sequence),
        encode("uint8", vaa.consistencyLevel),
        payload_str
    ]
    return body.join("")
}

export function sign(signers: string[], vaa: VAA<Payload>): Signature[] {
    const body = vaaBody(vaa)
    const hash = solidityKeccak256(["bytes"], [solidityKeccak256(["bytes"], ["0x" + body])])
    const ec = new elliptic.ec("secp256k1")

    return signers.map((signer, i) => {
        const key = ec.keyFromPrivate(signer)
        const signature = key.sign(Buffer.from(hash.substr(2), "hex"), { canonical: true })
        const packed = [
            signature.r.toString("hex").padStart(64, "0"),
            signature.s.toString("hex").padStart(64, "0"),
            encode("uint8", signature.recoveryParam)
        ].join("")
        return {
            guardianSetIndex: i,
            signature: packed
        }
    })
}

// Parse an address of given length, and render it as hex
const addressParser = (length: number) => new Parser()
    .endianess("big")
    .array("address", {
        type: "uint8",
        lengthInBytes: length,
        formatter: (arr) => Buffer.from(arr).toString("hex")
    })

export interface TransferFee {
    module: 'Core'
    type: 'TransferFee'
    amount: bigint
    recipient: Uint8Array
}

const transferFeeParser: P<TransferFee> = new P(new Parser()
    .endianess('big')
    .string('module', {
        length: 32,
        encoding: 'hex',
        assert: Buffer.from('Core').toString('hex').padStart(64, '0'),
        formatter: (_str) => 'Core'
    })
    .uint8('type', {
        assert: 4,
        formatter: (_action) => 'TransferFee'
    })
    .array('amount', {
        type: 'uint8',
        lengthInBytes: 32,
        formatter: (bytes) => BigInt(`0x${Buffer.from(bytes).toString('hex')}`)
    })
    .array('recipient', {
        type: 'uint8',
        lengthInBytes: 32,
        formatter: (bytes) => Uint8Array.from(bytes)
    }))

function serialiseTransferFee(payload: TransferFee): string {
    const body = [
        encode('bytes32', encodeString(payload.module)),
        encode('uint8', 4),
        payload.amount.toString(16).padStart(64, '0'),
        Buffer.from(payload.recipient).toString('hex').padStart(64, '0')
    ]
    return body.join('')
}

export interface UpdateMessageFee {
    module: 'Core'
    type: 'UpdateMessageFee'
    newMessageFee: bigint
}

const updateMessageFeeParser: P<UpdateMessageFee> = new P(new Parser()
    .endianess('big')
    .string('module', {
        length: 32,
        encoding: 'hex',
        assert: Buffer.from('Core').toString('hex').padStart(64, '0'),
        formatter: (_str) => 'Core'
    })
    .uint8('type', {
        assert: 3,
        formatter: (_action) => 'UpdateMessageFee'
    })
    .array('newMessageFee', {
        type: 'uint8',
        lengthInBytes: 32,
        formatter: (bytes) => BigInt(`0x${Buffer.from(bytes).toString('hex')}`)
    }))

function serialiseUpdateMessageFee(payload: UpdateMessageFee): string {
    const body = [
        encode('bytes32', encodeString(payload.module)),
        encode('uint8', 3),
        payload.newMessageFee.toString(16).padStart(64, '0')
    ]
    return body.join('')
}

////////////////////////////////////////////////////////////////////////////////
// Guardian set upgrade

export interface GuardianSetUpgrade {
    module: "Core"
    type: "GuardianSetUpgrade"
    newGuardianSetIndex: number
    newGuardianSetLength: number
    newGuardianSet: string[]
}

const guardianSetUpgradeParser: P<GuardianSetUpgrade> = new P(new Parser()
    .endianess("big")
    .string("module", {
        length: 32,
        encoding: "hex",
        assert: Buffer.from("Core").toString("hex").padStart(64, "0"),
        formatter: (_str) => "Core"
    })
    .uint8("type", {
        assert: 2,
        formatter: (_action) => "GuardianSetUpgrade"
    })
    .uint32("newGuardianSetIndex")
    .uint8("newGuardianSetLength")
    .array("newGuardianSet", {
        type: addressParser(20),
        length: "newGuardianSetLength",
        formatter: (arr: [{ address: string }]) => arr.map((addr) => addr.address)
    })
    .string("end", {
        greedy: true,
        assert: str => str === ""
    }))

function serialiseGuardianSetUpgrade(payload: GuardianSetUpgrade): string {
    const body = [
        encode("bytes32", encodeString(payload.module)),
        encode("uint8", 2),
        encode("uint32", payload.newGuardianSetIndex),
        encode("uint8", payload.newGuardianSet.length),
        ...payload.newGuardianSet
    ]
    return body.join("")
}

////////////////////////////////////////////////////////////////////////////////
// Contract upgrades

export interface CoreContractUpgrade {
    module: "Core"
    type: "ContractUpgrade"
    address: Uint8Array
}

// Parse a core contract upgrade payload
const coreContractUpgradeParser: P<CoreContractUpgrade> =
    new P(new Parser()
        .endianess("big")
        .string("module", {
            length: 32,
            encoding: "hex",
            assert: Buffer.from("Core").toString("hex").padStart(64, "0"),
            formatter: (_str) => 'Core'
        })
        .uint8("type", {
            assert: 1,
            formatter: (_action) => "ContractUpgrade"
        })
        .array("address", {
            type: "uint8",
            lengthInBytes: 32,
            formatter: (arr) => Uint8Array.from(arr)
        })
        .string("end", {
            greedy: true,
            assert: str => str === ""
        }))

function serialiseCoreContractUpgrade(payload: CoreContractUpgrade): string {
    const body = [
        encode("bytes32", encodeString(payload.module)),
        encode("uint8", 1),
        encode("bytes32", payload.address)
    ]
    return body.join("")
}

export interface AlphContractUpgrade<Module extends 'Core' | 'TokenBridge'> {
    module: Module
    type: 'ContractUpgrade'
    code: Uint8Array
    state: Uint8Array
}

function alphContractUpgradeParser<Module extends 'Core' | 'TokenBridge'>(module: Module): P<AlphContractUpgrade<Module>> {
    return new P(new Parser()
        .endianess('big')
        .string('module', {
            length: 32,
            encoding: 'hex',
            assert: Buffer.from(module).toString('hex').padStart(64, '0'),
            formatter: (_str) => module
        })
        .uint8('type', {
            assert: module === 'Core' ? 1 : 2,
            formatter: (_action) => 'ContractUpgrade'
        })
        .uint16('codeLength')
        .array('code', {
            type: 'uint8',
            lengthInBytes: 'codeLength',
            formatter: (arr) => Uint8Array.from(arr)
        })
        .array('state', {
            type: 'uint8',
            readUntil: 'eof',
            formatter: (arr) => Uint8Array.from(arr)
        })
        .string("end", {
            greedy: true,
            assert: str => str === ""
        })
    )
}

function serialiseAlphContractUpgrade<Module extends 'Core' | 'TokenBridge'>(payload: AlphContractUpgrade<Module>): string {
    const payloadId = payload.module === 'Core' ? 1 : 2
    const body = [
        encode('bytes32', encodeString(payload.module)),
        encode('uint8', payloadId),
        encode('uint16', payload.code.length),
        Buffer.from(payload.code).toString('hex'),
        Buffer.from(payload.state).toString('hex')
    ]
    return body.join('')
}

export interface GovernanceExtension<Chain extends ChainId, Module extends Modules, T> {
    chainId: Chain
    module: Module
    type: 'Extension'
    action: T
}

export function governanceExtensionParser<Chain extends ChainId, Module extends Modules, Action>(
    chain: Chain,
    module: Module,
    actionParser: P<Action>
): P<GovernanceExtension<Chain, Module, Action>> {
    return new P(new Parser()
        .endianess('big')
        .buffer('chainId', {
            length: () => 0,
            formatter: (_) => chain
        })
        .string('module', {
            length: 32,
            encoding: 'hex',
            assert: Buffer.from(module).toString('hex').padStart(64, '0'),
            formatter: (_str) => module
        })
        .string('type', {
            length: () => 0,
            formatter: (_) => 'Extension'
        })
        .buffer('action', {
            readUntil: 'eof',
            formatter: (bytes) => actionParser.parse(bytes)
        }))
}

function serialiseGovernanceExtension<Chain extends ChainId, Module extends Modules, Action>(
    payload: GovernanceExtension<Chain, Module, Action>,
    actionSerializer: (a: Action) => string
): string {
    return encode('bytes32', encodeString(payload.module)) + actionSerializer(payload.action)
}

export interface PortalContractUpgrade<Module extends "NFTBridge" | "TokenBridge"> {
    module: Module
    type: "ContractUpgrade"
    address: Uint8Array
}

// Parse a portal contract upgrade payload
function portalContractUpgradeParser<Module extends "NFTBridge" | "TokenBridge">(module: Module): P<PortalContractUpgrade<Module>> {
    return new P(new Parser()
        .endianess("big")
        .string("module", {
            length: 32,
            encoding: "hex",
            assert: Buffer.from(module).toString("hex").padStart(64, "0"),
            formatter: (_str) => module
        })
        .uint8("type", {
            assert: 2,
            formatter: (_action) => "ContractUpgrade"
        })
        .array("address", {
            type: "uint8",
            lengthInBytes: 32,
            formatter: (arr) => Uint8Array.from(arr)
        })
        .string("end", {
            greedy: true,
            assert: str => str === ""
        }))
}

function serialisePortalContractUpgrade<Module extends "NFTBridge" | "TokenBridge">(payload: PortalContractUpgrade<Module>): string {
    const body = [
        encode("bytes32", encodeString(payload.module)),
        encode("uint8", 2),
        encode("bytes32", payload.address)
    ]
    return body.join("")
}

////////////////////////////////////////////////////////////////////////////////
// Registrations

export interface PortalRegisterChain<Module extends "NFTBridge" | "TokenBridge"> {
    module: Module
    type: "RegisterChain"
    emitterChain: number
    emitterAddress: Uint8Array
}

// Parse a portal chain registration payload
function portalRegisterChainParser<Module extends "NFTBridge" | "TokenBridge">(module: Module): P<PortalRegisterChain<Module>> {
    return new P(new Parser()
        .endianess("big")
        .string("module", {
            length: 32,
            encoding: "hex",
            assert: Buffer.from(module).toString("hex").padStart(64, "0"),
            formatter: (_str) => module
        })
        .uint8("type", {
            assert: 1,
            formatter: (_action) => "RegisterChain"
        })
        .uint16("emitterChain")
        .array("emitterAddress", {
            type: "uint8",
            lengthInBytes: 32,
            // formatter: (arr) => Buffer.from(arr).toString("hex")
        })
        .string("end", {
            greedy: true,
            assert: str => str === ""
        })
    )
}

function serialisePortalRegisterChain<Module extends "NFTBridge" | "TokenBridge">(payload: PortalRegisterChain<Module>): string {
    const body = [
        encode("bytes32", encodeString(payload.module)),
        encode("uint8", 1),
        encode("uint16", payload.emitterChain),
        encode("bytes32", payload.emitterAddress)
    ]
    return body.join("")
}

// This function should be called after pattern matching on all possible options
// of an enum (union) type, so that typescript can derive that no other options
// are possible.  If (from JavaScript land) an unsupported argument is passed
// in, this function just throws. If the enum type is extended with new cases,
// the call to this function will then fail to compile, drawing attention to an
// unhandled case somewhere.
export function impossible(a: never): any {
    throw new Error(`Impossible: ${a}`)
}

////////////////////////////////////////////////////////////////////////////////
// Encoder utils

type Encoding
    = "uint8"
    | "uint16"
    | "uint32"
    | "uint64"
    | "bytes32"

function typeWidth(type: Encoding): number {
    switch (type) {
        case "uint8": return 1
        case "uint16": return 2
        case "uint32": return 4
        case "uint64": return 8
        case "bytes32": return 32
    }
}

// Couldn't find a satisfactory binary serialisation solution, so we just use
// the ethers library's encoding logic
function encode(type: Encoding, val: any): string {
    // ethers operates on hex strings (sigh) and left pads everything to 32
    // bytes (64 characters). We take last 2*n characters where n is the width
    // of the type being serialised in bytes (since a byte is represented as 2
    // digits in hex).
    return ethers.utils.defaultAbiCoder.encode([type], [val]).substr(-2 * typeWidth(type))
}

// Encode a string as binary left-padded to 32 bytes, represented as a hex
// string (64 chars long)
function encodeString(str: string): Buffer {
    return Buffer.from(Buffer.from(str).toString("hex").padStart(64, "0"), "hex")
}

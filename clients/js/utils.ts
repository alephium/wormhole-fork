import { ethers } from "ethers"
import { solidityKeccak256 } from "ethers/lib/utils"
import * as elliptic from "elliptic"
import {
    serializeVAABody,
    Signature,
    VAA,
    VAAPayload
} from "alephium-wormhole-sdk"

export function sign(signers: string[], vaa: VAA<VAAPayload>): Signature[] {
    const body = Buffer.from(serializeVAABody(vaa.body)).toString('hex')
    const hash = solidityKeccak256(["bytes"], [solidityKeccak256(["bytes"], ["0x" + body])])
    const ec = new elliptic.ec("secp256k1")

    return signers.map((signer, i) => {
        const key = ec.keyFromPrivate(signer)
        const signature = key.sign(Buffer.from(hash.substr(2), "hex"), { canonical: true })
        const packed = [
            signature.r.toString("hex").padStart(64, "0"),
            signature.s.toString("hex").padStart(64, "0"),
            encode("uint8", signature.recoveryParam)
        ].join('')
        return new Signature(i, Buffer.from(packed, 'hex'))
    })
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

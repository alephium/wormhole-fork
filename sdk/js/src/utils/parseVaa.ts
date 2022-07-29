import { BigNumber } from "@ethersproject/bignumber";
import { ChainId } from "./consts";

export const METADATA_REPLACE = new RegExp("\u0000", "g");

// TODO: remove `as ChainId` in next minor version as we can't ensure it will match our type definition

// note: actual first byte is message type
//     0   [u8; 32] token_address
//     32  u16      token_chain
//     34  [u8; 32] symbol
//     66  [u8; 32] name
//     98  u256     tokenId
//     130 u8       uri_len
//     131 [u8;len] uri
//     ?   [u8; 32] recipient
export const parseNFTPayload = (arr: Buffer) => {
  const originAddress = arr.slice(1, 1 + 32).toString("hex");
  const originChain = arr.readUInt16BE(33) as ChainId;
  const symbol = Buffer.from(arr.slice(35, 35 + 32))
    .toString("utf8")
    .replace(METADATA_REPLACE, "");
  const name = Buffer.from(arr.slice(67, 67 + 32))
    .toString("utf8")
    .replace(METADATA_REPLACE, "");
  const tokenId = BigNumber.from(arr.slice(99, 99 + 32));
  const uri_len = arr.readUInt8(131);
  const uri = Buffer.from(arr.slice(132, 132 + uri_len))
    .toString("utf8")
    .replace(METADATA_REPLACE, "");
  const target_offset = 132 + uri_len;
  const targetAddress = arr
    .slice(target_offset, target_offset + 32)
    .toString("hex");
  return {
    originAddress,
    originChain,
    symbol,
    name,
    tokenId,
    uri,
    targetAddress
  };
};

//     0   u256     amount
//     32  [u8; 32] token_address
//     64  u16      token_chain
//     66  [u8; 32] recipient
//     98  u16      recipient_chain
//     100 u256     fee
export const parseTransferPayload = (arr: Buffer) => ({
  amount: BigNumber.from(arr.slice(1, 1 + 32)).toBigInt(),
  originAddress: arr.slice(33, 33 + 32).toString("hex"),
  originChain: arr.readUInt16BE(65) as ChainId,
  targetAddress: arr.slice(67, 67 + 32).toString("hex"),
  fee: BigNumber.from(arr.slice(99, 99 + 32)).toBigInt(),
});

class Reader {
  private offset: number
  private data: Buffer

  constructor(data: Uint8Array) {
    this.offset = 0
    this.data = Buffer.from(data)
  }

  readUint8(): number {
    const value = this.data.readUInt8(this.offset)
    this.offset += 1
    return value
  }

  readUint16BE(): number {
    const value = this.data.readUInt16BE(this.offset)
    this.offset += 2
    return value
  }

  readUint32BE(): number {
    const value = this.data.readUInt32BE(this.offset)
    this.offset += 4
    return value
  }

  readUint64BE(): number {
    const msb = this.data.readUInt32BE(this.offset)
    const lsb = this.data.readUInt32BE(this.offset + 4)
    const value = msb * (2 ** 32) + lsb
    this.offset += 8
    return value
  }

  readBytes(length: number): Uint8Array {
    const end = this.offset + length
    const value = this.data.slice(this.offset, end)
    this.offset = end
    return value
  }

  remain(): Uint8Array {
    return this.data.slice(this.offset)
  }
}

export class Signature {
  index: number
  sig: Uint8Array

  constructor(index: number, sig: Uint8Array) {
    this.index = index
    this.sig = sig
  }
}

export class VAA {
  version: number
  guardianSetIndex: number
  signatures: Signature[]
  encodedBody: Uint8Array
  body: VAABody

  static from(data: Uint8Array): VAA {
    const reader = new Reader(data)
    const version = reader.readUint8()
    const guardianSetIndex = reader.readUint32BE()
    const signatureSize = reader.readUint8()
    const signatures = Array.from(Array(signatureSize).keys()).map(_ => {
      const sig = reader.readBytes(66)
      const index = sig[0] as number
      return new Signature(index, sig.slice(1))
    })
    const encodedBody = reader.remain()
    const body = VAABody.from(encodedBody)
    return new VAA(version, guardianSetIndex, signatures, encodedBody, body)
  }

  constructor(version: number, guardianSetIndex: number, signatures: Signature[], encodedBody: Uint8Array, body: VAABody) {
    this.version = version
    this.guardianSetIndex = guardianSetIndex
    this.signatures = signatures
    this.encodedBody = encodedBody
    this.body = body
  }
}

export class VAABody {
  timestamp: number
  nonce: number
  emitterChainId: ChainId
  targetChainId: ChainId
  emitterAddress: Uint8Array
  sequence: number
  consistencyLevel: number
  payload: Uint8Array

  static from(data: Uint8Array): VAABody {
    const reader = new Reader(data)
    const timestamp = reader.readUint32BE()
    const nonce = reader.readUint32BE()
    const emitterChainId = reader.readUint16BE() as ChainId
    const targetChainId = reader.readUint16BE() as ChainId
    const emitterAddress = reader.readBytes(32)
    const sequence = reader.readUint64BE()
    const consistencyLevel = reader.readUint8()
    const payload = reader.remain()
    return new VAABody(timestamp, nonce, emitterChainId, targetChainId, emitterAddress, sequence, consistencyLevel, payload)
  }

  constructor(timestamp: number, nonce: number, emitterChainId: ChainId, targetChainId: ChainId, emitterAddress: Uint8Array, sequence: number, consistencyLevel: number, payload: Uint8Array) {
    this.timestamp = timestamp
    this.nonce = nonce
    this.emitterChainId = emitterChainId
    this.targetChainId = targetChainId
    this.emitterAddress = emitterAddress
    this.sequence = sequence
    this.consistencyLevel = consistencyLevel
    this.payload = payload
  }
}

export function parseVAA(data: Uint8Array): VAA {
  return VAA.from(data)
}

//This returns a corrected amount, which accounts for the difference between the VAA
//decimals, and the decimals of the asset.
// const normalizeVaaAmount = (
//   amount: bigint,
//   assetDecimals: number
// ): bigint => {
//   const MAX_VAA_DECIMALS = 8;
//   if (assetDecimals <= MAX_VAA_DECIMALS) {
//     return amount;
//   }
//   const decimalStringVaa = formatUnits(amount, MAX_VAA_DECIMALS);
//   const normalizedAmount = parseUnits(decimalStringVaa, assetDecimals);
//   const normalizedBigInt = BigInt(truncate(normalizedAmount.toString(), 0));

//   return normalizedBigInt;
// };

// function truncate(str: string, maxDecimalDigits: number) {
//   if (str.includes(".")) {
//     const parts = str.split(".");
//     return parts[0] + "." + parts[1].slice(0, maxDecimalDigits);
//   }
//   return str;
// }

import { uint8ArrayToHex } from "./array";
import { ChainId, CHAIN_ID_ALEPHIUM } from "./consts";
import { keccak256 } from 'ethers/lib/utils'
import * as elliptic from "elliptic"

export const METADATA_REPLACE = new RegExp("\u0000", "g");

export const CoreModule = '00000000000000000000000000000000000000000000000000000000436f7265'
export const TokenBridgeModule = '000000000000000000000000000000000000000000546f6b656e427269646765'
export const NFTBridgeModule = '00000000000000000000000000000000000000000000004e4654427269646765'

export const TransferTokenPayloadId = 1
export const AttestTokenPayloadId = 2
export const TransferNFTPayloadId = 1

export const CoreContractUpgradeActionId = 1
export const GuardianSetUpgradeActionId = 2
export const UpdateMessageFeeActionId = 3
export const TransferFeeActionId = 4
export const RegisterChainActionId = 1
export const AppContractUpgradeActionId = 2
export const DestroyUnexecutedSequencesActionId = 240
export const UpdateMinimalConsistencyLevelActionId = 241
export const UpdateRefundAddressActionId = 242

export interface TransferNFT {
  type: 'TransferNFT'
  originAddress: Uint8Array // 32 bytes
  originChain: ChainId
  symbol: string
  name: string
  tokenId: bigint
  uri: Uint8Array
  targetAddress: Uint8Array // 32 bytes
}

export interface TransferToken {
  type: 'TransferToken'
  amount: bigint
  originAddress: Uint8Array // 32 bytes
  originChain: ChainId
  targetAddress: Uint8Array // 32 bytes
  fee: bigint
}

export interface AttestToken {
  type: 'AttestToken'
  tokenId: Uint8Array // 32 bytes
  tokenChainId: ChainId
  decimals: number
  symbol: string
  name: string
}

export type Module = 'Core' | 'TokenBridge' | 'NFTBridge'

export interface ContractUpgrade<M extends Module> {
  type: 'ContractUpgrade'
  module: M
  newContractAddress: Uint8Array // 32 bytes
}

export interface GuardianSetUpgrade {
  type: 'GuardianSetUpgrade'
  module: 'Core'
  newGuardianSetIndex: number
  newGuardianSet: Uint8Array[]
}

export interface UpdateMessageFee {
  type: 'UpdateMessageFee'
  module: 'Core'
  newMessageFee: bigint
}

export interface TransferFee {
  type: 'TransferFee'
  module: 'Core'
  amount: bigint
  recipient: Uint8Array
}

export interface AlphContractUpgrade<M extends 'Core' | 'TokenBridge'> {
  type: 'AlphContractUpgrade'
  module: M
  newCode: Uint8Array
  prevStateHash?: Uint8Array
  newState?: Uint8Array
}

export interface RegisterChain<M extends 'TokenBridge' | 'NFTBridge'> {
  type: 'RegisterChain'
  module: M
  emitterChainId: ChainId
  emitterAddress: Uint8Array
}

export interface DestroyUnexecutedSequences {
  type: 'DestroyUnexecutedSequences'
  module: 'TokenBridge'
  emitterChainId: ChainId
  indexes: bigint[]
}

export interface UpdateMinimalConsistencyLevel {
  type: 'UpdateMinimalConsistencyLevel'
  module: 'TokenBridge'
  newConsistencyLevel: number
}

export interface UpdateRefundAddress {
  type: 'UpdateRefundAddress'
  module: 'TokenBridge'
  newRefundAddress: Uint8Array
}

export type ApplicationPayload = TransferToken | TransferNFT | AttestToken
export type GovernancePayload =
  ContractUpgrade<Module>
    | GuardianSetUpgrade
    | UpdateMessageFee
    | TransferFee
    | AlphContractUpgrade<'Core' | 'TokenBridge'>
    | RegisterChain<'TokenBridge' | 'NFTBridge'>
    | DestroyUnexecutedSequences
    | UpdateMinimalConsistencyLevel
    | UpdateRefundAddress
export type VAAPayload = ApplicationPayload | GovernancePayload
export type PayloadName = VAAPayload['type']

export function isApplicationVAA(vaa: VAA<VAAPayload>): vaa is VAA<ApplicationPayload> {
  return vaa.body.payload.type === 'AttestToken'
    || vaa.body.payload.type === 'TransferToken'
    || vaa.body.payload.type === 'TransferNFT'
}

export function isGovernanceVAA(vaa: VAA<VAAPayload>): vaa is VAA<GovernancePayload> {
  return !isApplicationVAA(vaa)
}

export class Signature {
  index: number
  sig: Uint8Array

  constructor(index: number, sig: Uint8Array) {
    this.index = index
    this.sig = sig
  }

  static from(data: Uint8Array): Signature {
    if (data.length !== 66) {
      throw new Error(`Invalid signature ${uint8ArrayToHex(data)}, expected 66 bytes`)
    }
    return new Signature(data[0], data.slice(1))
  }

  serialize(): Uint8Array {
    return Buffer.concat([Buffer.from([this.index]), this.sig])
  }
}

export interface VAABody<T extends VAAPayload> {
  timestamp: number
  nonce: number
  emitterChainId: ChainId
  targetChainId: ChainId
  emitterAddress: Uint8Array
  sequence: bigint
  consistencyLevel: number
  payload: T
}

export interface VAA<T extends VAAPayload> {
  version: number
  guardianSetIndex: number
  signatures: Signature[]
  body: VAABody<T>
}

function bytesToModule(bytes: Uint8Array): Module {
  const hexStr = uint8ArrayToHex(bytes)
  switch (hexStr) {
    case CoreModule:
      return 'Core'
    case TokenBridgeModule:
      return 'TokenBridge'
    case NFTBridgeModule:
      return 'NFTBridge'
    default:
      throw new Error(`Invalid module: ${hexStr}`)
  }
}

class Reader {
  private offset: number
  private buffer: Buffer

  constructor(data: Uint8Array) {
    this.offset = 0
    this.buffer = Buffer.from(data)
  }

  private updateOffset(size: number) {
    this.offset += size
    if (this.offset > this.buffer.length) {
      throw new Error(`Read offset is out of range, offset: ${this.offset}, buffer size: ${this.buffer.length}`)
    }
  }

  readUInt8(): number {
    this.updateOffset(1)
    return this.buffer.readUInt8(this.offset - 1)
  }

  readUInt16BE(): number {
    this.updateOffset(2)
    return this.buffer.readUInt16BE(this.offset - 2)
  }

  readUInt32BE(): number {
    this.updateOffset(4)
    return this.buffer.readUInt32BE(this.offset - 4)
  }

  readUInt64BE(): bigint {
    this.updateOffset(8)
    return this.buffer.readBigUInt64BE(this.offset - 8)
  }

  readUInt256BE(): bigint {
    return BigInt('0x' + uint8ArrayToHex(this.readBytes(32)))
  }

  readModule(): Module {
    return bytesToModule(this.readBytes(32))
  }

  readBytes(length: number): Uint8Array {
    this.updateOffset(length)
    return this.buffer.slice(this.offset - length, this.offset)
  }

  remain(): Uint8Array {
    return this.buffer.slice(this.offset)
  }
}

class Writer {
  private offset: number
  private buffer: Buffer

  constructor(length: number) {
    this.offset = 0
    this.buffer = Buffer.allocUnsafe(length)
  }

  private updateOffset(size: number) {
    this.offset += size
    if (this.offset > this.buffer.length) {
      throw new Error(`Write offset is out of range, offset: ${this.offset}, buffer size: ${this.buffer.length}`)
    }
  }

  writeUInt8(value: number) {
    this.updateOffset(1)
    this.buffer.writeUInt8(value, this.offset - 1)
  }

  writeUInt16BE(value: number) {
    this.updateOffset(2)
    this.buffer.writeUInt16BE(value, this.offset - 2)
  }

  writeUInt32BE(value: number) {
    this.updateOffset(4)
    this.buffer.writeUInt32BE(value, this.offset - 4)
  }

  writeUInt64BE(value: bigint) {
    this.updateOffset(8)
    this.buffer.writeBigUInt64BE(value, this.offset - 8)
  }

  writeUInt256BE(value: bigint) {
    const bytes = Buffer.from(value.toString(16).padStart(64, '0'), 'hex')
    this.writeBytes(bytes)
  }

  writeModule(module: Module) {
    switch (module) {
      case 'Core':
        this.writeBytes(Buffer.from(CoreModule, 'hex'))
        break
      case 'TokenBridge':
        this.writeBytes(Buffer.from(TokenBridgeModule, 'hex'))
        break
      case 'NFTBridge':
        this.writeBytes(Buffer.from(NFTBridgeModule, 'hex'))
        break
    }
  }

  writeBytes(data: Uint8Array) {
    this.updateOffset(data.length)
    this.buffer.fill(data, this.offset - data.length, this.offset)
  }

  result(): Uint8Array {
    if (this.offset === this.buffer.length) {
      return this.buffer
    }
    throw new Error(`Write buffer is not full, offset: ${this.offset}, buffer size: ${this.buffer.length}`)
  }
}

export function extractBodyFromVAA(signedVAA: Uint8Array): Uint8Array {
  const signatureSize = signedVAA[5]
  const offset = 6 + signatureSize * 66
  return signedVAA.slice(offset)
}

export function extractPayloadFromVAA(signedVAA: Uint8Array): Uint8Array {
  const signatureSize = signedVAA[5]
  const offset = 6 + signatureSize * 66 + 53
  return signedVAA.slice(offset)
}

export function extractSequenceFromVAA(signedVAA: Uint8Array): bigint {
  const signatureSize = signedVAA[5]
  const offset = 6 + signatureSize * 66 + 44
  return Buffer.from(signedVAA.slice(offset, offset + 8)).readBigUInt64BE()
}

function _serializeVAABody<T extends VAAPayload>(
  body: VAABody<T>,
  payloadSerializer: (payload: T) => Uint8Array
): Uint8Array {
  const writer = new Writer(53)
  writer.writeUInt32BE(body.timestamp)
  writer.writeUInt32BE(body.nonce)
  writer.writeUInt16BE(body.emitterChainId)
  writer.writeUInt16BE(body.targetChainId)
  writer.writeBytes(body.emitterAddress)
  writer.writeUInt64BE(body.sequence)
  writer.writeUInt8(body.consistencyLevel)
  return Buffer.concat([writer.result(), payloadSerializer(body.payload)])
}

function _serializeVAA<T extends VAAPayload>(
  vaa: VAA<T>,
  payloadSerializer: (payload: T) => Uint8Array
): Uint8Array {
  const writer = new Writer(6)
  writer.writeUInt8(vaa.version)
  writer.writeUInt32BE(vaa.guardianSetIndex)
  writer.writeUInt8(vaa.signatures.length)
  const signatures = Buffer.concat(vaa.signatures.map(sig => sig.serialize()))
  return Buffer.concat([writer.result(), signatures, _serializeVAABody(vaa.body, payloadSerializer)])
}

function _deserializeVAABody<T extends VAAPayload>(
  data: Uint8Array,
  payloadDeserializer: (payload: Uint8Array) => T
): VAABody<T> {
  const reader = new Reader(data)
  return {
    timestamp: reader.readUInt32BE(),
    nonce: reader.readUInt32BE(),
    emitterChainId: reader.readUInt16BE() as ChainId,
    targetChainId: reader.readUInt16BE() as ChainId,
    emitterAddress: reader.readBytes(32),
    sequence: reader.readUInt64BE(),
    consistencyLevel: reader.readUInt8(),
    payload: payloadDeserializer(reader.remain())
  }
}

function _deserializeVAA<T extends VAAPayload>(
  data: Uint8Array,
  payloadDeserializer: (payload: Uint8Array) => T
): VAA<T> {
  const reader = new Reader(data)
  const version = reader.readUInt8()
  const guardianSetIndex = reader.readUInt32BE()
  const signatureSize = reader.readUInt8()
  if (signatureSize === 0) {
    throw new Error(`Invalid signature size ${signatureSize}`)
  }
  const signatures = Array.from(Array(signatureSize).keys()).map(() => {
    return Signature.from(reader.readBytes(66))
  })
  const body = _deserializeVAABody(reader.remain(), payloadDeserializer)
  return {
    version,
    guardianSetIndex,
    signatures,
    body
  }
}

function validatePayloadSize(payload: Uint8Array, expected: number, type: PayloadName) {
  if (payload.length !== expected) {
    throw new Error(`Invalid ${type} payload ${uint8ArrayToHex(payload)}, expected ${expected} bytes`)
  }
}

function validatePayloadId(payloadId: number, expected: number, type: PayloadName) {
  if (payloadId !== expected) {
    throw new Error(`Invalid ${type} payload id ${payloadId}, expected ${expected}`)
  }
}

function validateModule(module: Module, expected: Module, type: PayloadName) {
  if (module !== expected) {
    throw new Error(`Invalid ${type} payload module ${module}, expected ${expected}`)
  }
}

export function deserializeTransferTokenPayload(payload: Uint8Array): TransferToken {
  validatePayloadSize(payload, 131, 'TransferToken')
  const reader = new Reader(payload)
  validatePayloadId(reader.readUInt8(), TransferTokenPayloadId, 'TransferToken')
  return {
    type: 'TransferToken',
    amount: reader.readUInt256BE(),
    originAddress: reader.readBytes(32),
    originChain: reader.readUInt16BE() as ChainId,
    targetAddress: reader.readBytes(32),
    fee: reader.readUInt256BE()
  }
}

export function serializeTransferTokenPayload(payload: TransferToken): Uint8Array {
  const writer = new Writer(131)
  writer.writeUInt8(TransferTokenPayloadId) // payloadId
  writer.writeUInt256BE(payload.amount)
  writer.writeBytes(payload.originAddress)
  writer.writeUInt16BE(payload.originChain)
  writer.writeBytes(payload.targetAddress)
  writer.writeUInt256BE(payload.fee)
  return writer.result()
}

export function deserializeTransferTokenVAA(data: Uint8Array): VAA<TransferToken> {
  return _deserializeVAA(data, deserializeTransferTokenPayload)
}

export function serializeTransferTokenVAA(vaa: VAA<TransferToken>): Uint8Array {
  return _serializeVAA(vaa, serializeTransferTokenPayload)
}

function bytes32ToUtf8String(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8').replace(METADATA_REPLACE, '')
}

function utf8StringTo32Bytes(str: string): Uint8Array {
  const buf = Buffer.from(str, 'utf8')
  if (buf.length > 32) {
    throw new Error(`String ${str} exceed 32 bytes`)
  }
  const prefix = Buffer.alloc(32 - buf.length)
  return Buffer.concat([prefix, buf])
}

export function deserializeTransferNFTPayload(payload: Uint8Array): TransferNFT {
  const reader = new Reader(payload)
  validatePayloadId(reader.readUInt8(), TransferNFTPayloadId, 'TransferNFT')
  const transferNFT = {
    type: 'TransferNFT' as const,
    originAddress: reader.readBytes(32),
    originChain: reader.readUInt16BE() as ChainId,
    symbol: bytes32ToUtf8String(reader.readBytes(32)),
    name: bytes32ToUtf8String(reader.readBytes(32)),
    tokenId: reader.readUInt256BE(),
    uri: reader.readBytes(reader.readUInt8()),
    targetAddress: reader.readBytes(32)
  }
  if (reader.remain().length !== 0) {
    throw new Error('Invalid size of transfer NFT VAA')
  }
  return transferNFT
}

export function deserializeTransferNFTVAA(data: Uint8Array): VAA<TransferNFT> {
  return _deserializeVAA(data, deserializeTransferNFTPayload)
}

export function serializeTransferNFTPayload(payload: TransferNFT): Uint8Array {
  const writer = new Writer(164 + payload.uri.length)
  writer.writeUInt8(TransferNFTPayloadId) // payload id
  writer.writeBytes(payload.originAddress)
  writer.writeUInt16BE(payload.originChain)
  writer.writeBytes(utf8StringTo32Bytes(payload.symbol))
  writer.writeBytes(utf8StringTo32Bytes(payload.name))
  writer.writeUInt256BE(payload.tokenId)
  writer.writeUInt8(payload.uri.length)
  writer.writeBytes(payload.uri)
  writer.writeBytes(payload.targetAddress)
  return writer.result()
}

export function serializeTransferNFTVAA(vaa: VAA<TransferNFT>): Uint8Array {
  return _serializeVAA(vaa, serializeTransferNFTPayload)
}

export function deserializeAttestTokenPayload(payload: Uint8Array): AttestToken {
  validatePayloadSize(payload, 100, 'AttestToken')
  const reader = new Reader(payload)
  validatePayloadId(reader.readUInt8(), AttestTokenPayloadId, 'AttestToken')
  return {
    type: 'AttestToken',
    tokenId: reader.readBytes(32),
    tokenChainId: reader.readUInt16BE() as ChainId,
    decimals: reader.readUInt8(),
    symbol: bytes32ToUtf8String(reader.readBytes(32)),
    name: bytes32ToUtf8String(reader.readBytes(32))
  }
}

export function deserializeAttestTokenVAA(data: Uint8Array): VAA<AttestToken> {
  return _deserializeVAA(data, deserializeAttestTokenPayload)
}

export function serializeAttestTokenPayload(payload: AttestToken): Uint8Array {
  const writer = new Writer(100)
  writer.writeUInt8(AttestTokenPayloadId) // payload id
  writer.writeBytes(payload.tokenId)
  writer.writeUInt16BE(payload.tokenChainId)
  writer.writeUInt8(payload.decimals)
  writer.writeBytes(utf8StringTo32Bytes(payload.symbol))
  writer.writeBytes(utf8StringTo32Bytes(payload.name))
  return writer.result()
}

export function serializeAttestTokenVAA(vaa: VAA<AttestToken>): Uint8Array {
  return _serializeVAA(vaa, serializeAttestTokenPayload)
}

function getContractUpgradeActionIdByModule(module: Module): number {
  return module === 'Core' ? CoreContractUpgradeActionId : AppContractUpgradeActionId
}

export function deserializeContractUpgradePayload(data: Uint8Array): ContractUpgrade<Module> {
  validatePayloadSize(data, 65, 'ContractUpgrade')
  const reader = new Reader(data)
  const module = reader.readModule()
  const actionId = getContractUpgradeActionIdByModule(module)
  validatePayloadId(reader.readUInt8(), actionId, 'ContractUpgrade')
  const newContractAddress = reader.readBytes(32)
  return {
    type: 'ContractUpgrade',
    module,
    newContractAddress
  }
}

export function deserializeCoreContractUpgradeVAA(data: Uint8Array): VAA<ContractUpgrade<'Core'>> {
  return _deserializeVAA(data, (payload) => {
    const decoded = deserializeContractUpgradePayload(payload)
    validateModule(decoded.module, 'Core', 'ContractUpgrade')
    return decoded as ContractUpgrade<'Core'>
  })
}

export function deserializeTokenBridgeContractUpgradeVAA(data: Uint8Array): VAA<ContractUpgrade<'TokenBridge'>> {
  return _deserializeVAA(data, (payload) => {
    const decoded = deserializeContractUpgradePayload(payload)
    validateModule(decoded.module, 'TokenBridge', 'ContractUpgrade')
    return decoded as ContractUpgrade<'TokenBridge'>
  })
}

export function deserializeNFTBridgeContractUpgradeVAA(data: Uint8Array): VAA<ContractUpgrade<'NFTBridge'>> {
  return _deserializeVAA(data, (payload) => {
    const decoded = deserializeContractUpgradePayload(payload)
    validateModule(decoded.module, 'NFTBridge', 'ContractUpgrade')
    return decoded as ContractUpgrade<'NFTBridge'>
  })
}

export function serializeContractUpgradePayload(payload: ContractUpgrade<Module>): Uint8Array {
  const writer = new Writer(65)
  writer.writeModule(payload.module)
  const actionId = getContractUpgradeActionIdByModule(payload.module)
  writer.writeUInt8(actionId)
  writer.writeBytes(payload.newContractAddress)
  return writer.result()
}

export function serializeContractUpgradeVAA(vaa: VAA<ContractUpgrade<Module>>): Uint8Array {
  return _serializeVAA(vaa, serializeContractUpgradePayload)
}

export function deserializeGuardianSetUpgradePayload(data: Uint8Array): GuardianSetUpgrade {
  const reader = new Reader(data)
  validateModule(reader.readModule(), 'Core', 'GuardianSetUpgrade')
  validatePayloadId(reader.readUInt8(), GuardianSetUpgradeActionId, 'GuardianSetUpgrade')
  const newGuardianSetIndex = reader.readUInt32BE()
  const newGuardianSetSize = reader.readUInt8()
  const newGuardianSet = Array.from(Array(newGuardianSetSize).keys()).map(() => {
    return reader.readBytes(20)
  })
  validatePayloadSize(data, 38 + newGuardianSet.length * 20, 'GuardianSetUpgrade')
  return {
    type: 'GuardianSetUpgrade',
    module: 'Core',
    newGuardianSetIndex,
    newGuardianSet
  }
}

export function deserializeGuardianSetUpgradeVAA(data: Uint8Array): VAA<GuardianSetUpgrade> {
  return _deserializeVAA(data, deserializeGuardianSetUpgradePayload)
}

export function serializeGuardianSetUpgradePayload(payload: GuardianSetUpgrade): Uint8Array {
  const writer = new Writer(38 + payload.newGuardianSet.length * 20)
  writer.writeModule('Core')
  writer.writeUInt8(GuardianSetUpgradeActionId) // action id
  writer.writeUInt32BE(payload.newGuardianSetIndex)
  writer.writeUInt8(payload.newGuardianSet.length)
  payload.newGuardianSet.forEach(guardian => {
    writer.writeBytes(guardian)
  })
  return writer.result()
}

export function serializeGuardianSetUpgradeVAA(vaa: VAA<GuardianSetUpgrade>): Uint8Array {
  return _serializeVAA(vaa, serializeGuardianSetUpgradePayload)
}

export function deserializeUpdateMessageFeePayload(data: Uint8Array): UpdateMessageFee {
  validatePayloadSize(data, 65, 'UpdateMessageFee')
  const reader = new Reader(data)
  validateModule(reader.readModule(), 'Core', 'UpdateMessageFee')
  validatePayloadId(reader.readUInt8(), UpdateMessageFeeActionId, 'UpdateMessageFee')
  const newMessageFee = reader.readUInt256BE()
  return {
    type: 'UpdateMessageFee',
    module: 'Core',
    newMessageFee
  }
}

export function deserializeUpdateMessageFeeVAA(data: Uint8Array): VAA<UpdateMessageFee> {
  return _deserializeVAA(data, deserializeUpdateMessageFeePayload)
}

export function serializeUpdateMessageFeePayload(payload: UpdateMessageFee): Uint8Array {
  const writer = new Writer(65)
  writer.writeModule('Core')
  writer.writeUInt8(UpdateMessageFeeActionId) // action id
  writer.writeUInt256BE(payload.newMessageFee)
  return writer.result()
}

export function serializeUpdateMessageFeeVAA(vaa: VAA<UpdateMessageFee>): Uint8Array {
  return _serializeVAA(vaa, serializeUpdateMessageFeePayload)
}

export function deserializeTransferFeePayload(data: Uint8Array): TransferFee {
  validatePayloadSize(data, 97, 'TransferFee')
  const reader = new Reader(data)
  validateModule(reader.readModule(), 'Core', 'TransferFee')
  validatePayloadId(reader.readUInt8(), TransferFeeActionId, 'TransferFee')
  return {
    type: 'TransferFee',
    module: 'Core',
    amount: reader.readUInt256BE(),
    recipient: reader.readBytes(32)
  }
}

export function deserializeTransferFeeVAA(data: Uint8Array): VAA<TransferFee> {
  return _deserializeVAA(data, deserializeTransferFeePayload)
}

export function serializeTransferFeePayload(payload: TransferFee): Uint8Array {
  const writer = new Writer(97)
  writer.writeModule('Core')
  writer.writeUInt8(TransferFeeActionId) // action id
  writer.writeUInt256BE(payload.amount)
  writer.writeBytes(payload.recipient)
  return writer.result()
}

export function serializeTransferFeeVAA(vaa: VAA<TransferFee>): Uint8Array {
  return _serializeVAA(vaa, serializeTransferFeePayload)
}

export function deserializeAlphContractUpgradePayload(data: Uint8Array): AlphContractUpgrade<'Core' | 'TokenBridge'> {
  const reader = new Reader(data)
  const module = reader.readModule()
  if (module === 'NFTBridge') {
    throw new Error('NFTBridge does not supported in Alephium now')
  }
  const actionId = getContractUpgradeActionIdByModule(module)
  validatePayloadId(reader.readUInt8(), actionId, 'AlphContractUpgrade')
  const codeLength = reader.readUInt16BE()
  const newCode = reader.readBytes(codeLength)
  if (35 + codeLength === data.length) {
    return {
      type: 'AlphContractUpgrade',
      module,
      newCode
    }
  }

  const prevStateHash = reader.readBytes(32)
  const newStateLength = reader.readUInt16BE()
  const newState = reader.readBytes(newStateLength)
  validatePayloadSize(data, 35 + codeLength + 32 + 2 + newStateLength, 'AlphContractUpgrade')
  return {
    type: 'AlphContractUpgrade',
    module,
    newCode,
    prevStateHash,
    newState
  }
}

export function deserializeAlphCoreContractUpgradeVAA(data: Uint8Array): VAA<AlphContractUpgrade<'Core'>> {
  return _deserializeVAA(data, (payload) => {
    const decoded = deserializeAlphContractUpgradePayload(payload)
    validateModule(decoded.module, 'Core', 'AlphContractUpgrade')
    return decoded as AlphContractUpgrade<'Core'>
  })
}

export function deserializeAlphTokenBridgeContractUpgradeVAA(data: Uint8Array): VAA<AlphContractUpgrade<'TokenBridge'>> {
  return _deserializeVAA(data, (payload) => {
    const decoded = deserializeAlphContractUpgradePayload(payload)
    validateModule(decoded.module, 'TokenBridge', 'AlphContractUpgrade')
    return decoded as AlphContractUpgrade<'TokenBridge'>
  })
}

export function serializeAlphContractUpgradePayload(payload: AlphContractUpgrade<'Core' | 'TokenBridge'>): Uint8Array {
  const writer0 = new Writer(35)
  writer0.writeModule(payload.module)
  writer0.writeUInt8(getContractUpgradeActionIdByModule(payload.module))
  writer0.writeUInt16BE(payload.newCode.length)
  const buffer0 = Buffer.concat([writer0.result(), payload.newCode])

  if (payload.prevStateHash === undefined && payload.newState === undefined) {
    return buffer0
  }

  if (payload.prevStateHash === undefined || payload.newState === undefined) {
    throw new Error('Invalid alephium contract upgrade payload')
  }

  const writer1 = new Writer(34)
  writer1.writeBytes(payload.prevStateHash)
  writer1.writeUInt16BE(payload.newState.length)
  return Buffer.concat([buffer0, writer1.result(), payload.newState])
}

export function serializeAlphContractUpgradeVAA(vaa: VAA<AlphContractUpgrade<'Core' | 'TokenBridge'>>): Uint8Array {
  return _serializeVAA(vaa, serializeAlphContractUpgradePayload)
}

export function deserializeRegisterChainPayload(payload: Uint8Array): RegisterChain<'TokenBridge' | 'NFTBridge'> {
  validatePayloadSize(payload, 67, 'RegisterChain')
  const reader = new Reader(payload)
  const module = reader.readModule()
  if (module === 'Core') {
    throw new Error('Invalid RegisterChain module: Core')
  }
  validatePayloadId(reader.readUInt8(), RegisterChainActionId, 'RegisterChain')
  const emitterChainId = reader.readUInt16BE() as ChainId
  const emitterAddress = reader.readBytes(32)
  return {
    type: 'RegisterChain',
    module,
    emitterChainId,
    emitterAddress
  }
}

export function deserializeTokenBridgeRegisterChainVAA(data: Uint8Array): VAA<RegisterChain<'TokenBridge'>> {
  return _deserializeVAA(data, (payload) => {
    const decoded = deserializeRegisterChainPayload(payload)
    validateModule(decoded.module, 'TokenBridge', 'RegisterChain')
    return decoded as RegisterChain<'TokenBridge'>
  })
}

export function deserializeNFTBridgeRegisterChainVAA(data: Uint8Array): VAA<RegisterChain<'NFTBridge'>> {
  return _deserializeVAA(data, (payload) => {
    const decoded = deserializeRegisterChainPayload(payload)
    validateModule(decoded.module, 'NFTBridge', 'RegisterChain')
    return decoded as RegisterChain<'NFTBridge'>
  })
}

export function serializeRegisterChainPayload(payload: RegisterChain<'NFTBridge' | 'TokenBridge'>) {
  const writer = new Writer(67)
  writer.writeModule(payload.module)
  writer.writeUInt8(RegisterChainActionId) // action id
  writer.writeUInt16BE(payload.emitterChainId)
  writer.writeBytes(payload.emitterAddress)
  return writer.result()
}

export function serializeRegisterChainVAA(vaa: VAA<RegisterChain<'NFTBridge' | 'TokenBridge'>>) {
  return _serializeVAA(vaa, serializeRegisterChainPayload)
}

export function deserializeDestroyUnexecutedSequencesPayload(payload: Uint8Array): DestroyUnexecutedSequences {
  const reader = new Reader(payload)
  validateModule(reader.readModule(), 'TokenBridge', 'DestroyUnexecutedSequences')
  validatePayloadId(reader.readUInt8(), DestroyUnexecutedSequencesActionId, 'DestroyUnexecutedSequences')
  const emitterChainId = reader.readUInt16BE() as ChainId
  const size = reader.readUInt16BE()
  validatePayloadSize(payload, 37 + size * 8, 'DestroyUnexecutedSequences')
  const indexes = Array.from(Array(size).keys()).map(() => {
    return reader.readUInt64BE()
  })
  return {
    type: 'DestroyUnexecutedSequences',
    module: 'TokenBridge',
    emitterChainId,
    indexes
  }
}

export function deserializeDestroyUnexecutedSequencesVAA(data: Uint8Array): VAA<DestroyUnexecutedSequences> {
  return _deserializeVAA(data, deserializeDestroyUnexecutedSequencesPayload)
}

export function serializeDestroyUnexecutedSequencesPayload(payload: DestroyUnexecutedSequences): Uint8Array {
  const writer = new Writer(37 + payload.indexes.length * 8)
  writer.writeModule('TokenBridge')
  writer.writeUInt8(DestroyUnexecutedSequencesActionId) // action id
  writer.writeUInt16BE(payload.emitterChainId)
  writer.writeUInt16BE(payload.indexes.length)
  payload.indexes.forEach(index => {
    writer.writeUInt64BE(index)
  })
  return writer.result()
}

export function serializeDestroyUnexecutedSequencesVAA(vaa: VAA<DestroyUnexecutedSequences>): Uint8Array {
  return _serializeVAA(vaa, serializeDestroyUnexecutedSequencesPayload)
}

export function deserializeUpdateMinimalConsistencyLevelPayload(payload: Uint8Array): UpdateMinimalConsistencyLevel {
  validatePayloadSize(payload, 34, 'UpdateMinimalConsistencyLevel')
  const reader = new Reader(payload)
  validateModule(reader.readModule(), 'TokenBridge', 'UpdateMinimalConsistencyLevel')
  validatePayloadId(reader.readUInt8(), UpdateMinimalConsistencyLevelActionId, 'UpdateMinimalConsistencyLevel')
  const newConsistencyLevel = reader.readUInt8()
  return {
    type: 'UpdateMinimalConsistencyLevel',
    module: 'TokenBridge',
    newConsistencyLevel
  }
}

export function deserializeUpdateMinimalConsistencyLevelVAA(data: Uint8Array): VAA<UpdateMinimalConsistencyLevel> {
  return _deserializeVAA(data, deserializeUpdateMinimalConsistencyLevelPayload)
}

export function serializeUpdateMinimalConsistencyLevelPayload(payload: UpdateMinimalConsistencyLevel): Uint8Array {
  const writer = new Writer(34)
  writer.writeModule('TokenBridge')
  writer.writeUInt8(UpdateMinimalConsistencyLevelActionId)
  writer.writeUInt8(payload.newConsistencyLevel)
  return writer.result()
}

export function serializeUpdateMinimalConsistencyLevelVAA(vaa: VAA<UpdateMinimalConsistencyLevel>): Uint8Array {
  return _serializeVAA(vaa, serializeUpdateMinimalConsistencyLevelPayload)
}

export function deserializeUpdateRefundAddressPayload(payload: Uint8Array): UpdateRefundAddress {
  const reader = new Reader(payload)
  validateModule(reader.readModule(), 'TokenBridge', 'UpdateRefundAddress')
  validatePayloadId(reader.readUInt8(), UpdateRefundAddressActionId, 'UpdateRefundAddress')
  const size = reader.readUInt16BE()
  validatePayloadSize(payload, 35 + size, 'UpdateRefundAddress')
  const newRefundAddress = reader.readBytes(size)
  return {
    type: 'UpdateRefundAddress',
    module: 'TokenBridge',
    newRefundAddress
  }
}

export function deserializeUpdateRefundAddressVAA(data: Uint8Array): VAA<UpdateRefundAddress> {
  return _deserializeVAA(data, deserializeUpdateRefundAddressPayload)
}

export function serializeUpdateRefundAddressPayload(payload: UpdateRefundAddress): Uint8Array {
  const writer = new Writer(35)
  writer.writeModule('TokenBridge')
  writer.writeUInt8(UpdateRefundAddressActionId)
  writer.writeUInt16BE(payload.newRefundAddress.length)
  return Buffer.concat([writer.result(), payload.newRefundAddress])
}

export function serializeUpdateRefundAddressVAA(vaa: VAA<UpdateRefundAddress>): Uint8Array {
  return _serializeVAA(vaa, serializeUpdateRefundAddressPayload)
}

function deserializeApplicationVAA(signedVAA: Uint8Array, payloadId: number, payloadSize: number) {
  if (payloadId === AttestTokenPayloadId) {
    return deserializeAttestTokenVAA(signedVAA)
  }
  if (payloadSize === 131) {
    return deserializeTransferTokenVAA(signedVAA)
  }
  return deserializeTransferNFTVAA(signedVAA)
}

function deserializeCoreGovernanceVAA(signedVAA: Uint8Array, actionId: number, targetChainId: ChainId) {
  switch (actionId) {
    case CoreContractUpgradeActionId:
      if (targetChainId === CHAIN_ID_ALEPHIUM) {
        return deserializeAlphCoreContractUpgradeVAA(signedVAA)
      }
      return deserializeCoreContractUpgradeVAA(signedVAA)
    case GuardianSetUpgradeActionId:
      return deserializeGuardianSetUpgradeVAA(signedVAA)
    case UpdateMessageFeeActionId:
      return deserializeUpdateMessageFeeVAA(signedVAA)
    case TransferFeeActionId:
      return deserializeTransferFeeVAA(signedVAA)
    default:
      throw new Error(`Invalid CoreGovernancePayload action id ${actionId}`)
  }
}

function deserializeTokenBridgeGovernanceVAA(signedVAA: Uint8Array, actionId: number, targetChainId: ChainId) {
  switch (actionId) {
    case RegisterChainActionId:
      return deserializeTokenBridgeRegisterChainVAA(signedVAA)
    case AppContractUpgradeActionId:
      if (targetChainId === CHAIN_ID_ALEPHIUM) {
        return deserializeAlphTokenBridgeContractUpgradeVAA(signedVAA)
      }
      return deserializeTokenBridgeContractUpgradeVAA(signedVAA)
    case DestroyUnexecutedSequencesActionId:
      return deserializeDestroyUnexecutedSequencesVAA(signedVAA)
    case UpdateMinimalConsistencyLevelActionId:
      return deserializeUpdateMinimalConsistencyLevelVAA(signedVAA)
    case UpdateRefundAddressActionId:
      return deserializeUpdateRefundAddressVAA(signedVAA)
    default:
      throw new Error(`Invalid TokenBridgeGovernancePayload action id ${actionId}`)
  }
}

function deserializeNFTBridgeGovernanceVAA(signedVAA: Uint8Array, actionId: number) {
  switch (actionId) {
    case RegisterChainActionId:
      return deserializeNFTBridgeRegisterChainVAA(signedVAA)
    case AppContractUpgradeActionId:
      return deserializeNFTBridgeContractUpgradeVAA(signedVAA)
    default:
      throw new Error(`Invalid NFTBridgeGovernancePayload action id ${actionId}`)
  }
}

function deserializeGovernanceVAA(
  signedVAA: Uint8Array,
  module: Module,
  actionId: number,
  targetChainId: ChainId
): VAA<GovernancePayload> {
  switch (module) {
    case 'Core':
      return deserializeCoreGovernanceVAA(signedVAA, actionId, targetChainId)
    case 'TokenBridge':
      return deserializeTokenBridgeGovernanceVAA(signedVAA, actionId, targetChainId)
    case 'NFTBridge':
      return deserializeNFTBridgeGovernanceVAA(signedVAA, actionId)
  }
}

export function deserializeVAA(signedVAA: Uint8Array): VAA<VAAPayload> {
  const body = extractBodyFromVAA(signedVAA)
  const payload = body.slice(53)
  const payloadId = payload[0]
  if (payloadId !== 0) {
    return deserializeApplicationVAA(signedVAA, payloadId, payload.length)
  }

  const module = bytesToModule(payload.slice(0, 32))
  const actionId = payload[32]
  const targetChainId = Buffer.from(body).readUInt16BE(10) as ChainId
  return deserializeGovernanceVAA(signedVAA, module, actionId, targetChainId)
}

export const VAAPayloadSerializers: {
  [k in PayloadName]: (v: VAAPayload & { type: k }) => Uint8Array
} = {
  'ContractUpgrade': serializeContractUpgradePayload,
  'GuardianSetUpgrade': serializeGuardianSetUpgradePayload,
  'UpdateMessageFee': serializeUpdateMessageFeePayload,
  'TransferFee': serializeTransferFeePayload,
  'AlphContractUpgrade': serializeAlphContractUpgradePayload,
  'RegisterChain': serializeRegisterChainPayload,
  'DestroyUnexecutedSequences': serializeDestroyUnexecutedSequencesPayload,
  'UpdateMinimalConsistencyLevel': serializeUpdateMinimalConsistencyLevelPayload,
  'UpdateRefundAddress': serializeUpdateRefundAddressPayload,
  'AttestToken': serializeAttestTokenPayload,
  'TransferToken': serializeTransferTokenPayload,
  'TransferNFT': serializeTransferNFTPayload
}

export const VAAPayloadDeserializers: {
  [k in PayloadName]: (payload: Uint8Array) => VAAPayload & { type: k }
} = {
  'ContractUpgrade': deserializeContractUpgradePayload,
  'GuardianSetUpgrade': deserializeGuardianSetUpgradePayload,
  'UpdateMessageFee': deserializeUpdateMessageFeePayload,
  'TransferFee': deserializeTransferFeePayload,
  'AlphContractUpgrade': deserializeAlphContractUpgradePayload,
  'RegisterChain': deserializeRegisterChainPayload,
  'DestroyUnexecutedSequences': deserializeDestroyUnexecutedSequencesPayload,
  'UpdateMinimalConsistencyLevel': deserializeUpdateMinimalConsistencyLevelPayload,
  'UpdateRefundAddress': deserializeUpdateRefundAddressPayload,
  'AttestToken': deserializeAttestTokenPayload,
  'TransferToken': deserializeTransferTokenPayload,
  'TransferNFT': deserializeTransferNFTPayload 
}

export function serializeVAABody<T extends VAAPayload>(body: VAABody<T>): Uint8Array {
  const serializer = VAAPayloadSerializers[body.payload.type] as (payload: T) => Uint8Array
  return _serializeVAABody(body, serializer)
}

export function serializeVAA<T extends VAAPayload>(vaa: VAA<T>): Uint8Array {
  const serializer = VAAPayloadSerializers[vaa.body.payload.type] as (payload: T) => Uint8Array
  return _serializeVAA(vaa, serializer)
}

export function signVAABody<T extends VAAPayload>(keys: string[], body: VAABody<T>): Signature[] {
  const hash = keccak256(keccak256(serializeVAABody(body))).slice(2)
  const ec = new elliptic.ec("secp256k1")

  return keys.map((k, index) => {
    const key = ec.keyFromPrivate(k)
    const sig = key.sign(hash, { canonical: true })
    const signature = [
      sig.r.toString(16).padStart(64, '0'),
      sig.s.toString(16).padStart(64, '0'),
      (sig.recoveryParam as number).toString(16).padStart(2, '0')
    ].join('')
    return new Signature(index, Buffer.from(signature, 'hex'))
  })
}

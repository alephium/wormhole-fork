import { randomBytes } from 'crypto'
import { ethers } from 'ethers'
import * as base58 from 'bs58'
import { nonce, zeroPad } from '../../lib/utils'
import * as elliptic from 'elliptic'
import { ContractState, contractIdFromAddress, binToHex, Project, encodeI256, Fields } from '@alephium/web3'
import { MathTest } from '../../artifacts/ts'

export const CHAIN_ID_ALEPHIUM = 255
export const dustAmount = BigInt('1000000000000000')
export const oneAlph = BigInt('1000000000000000000')
export const minimalAlphInContract = oneAlph
export const tokenMax = (1n << 256n) - 1n
export const gasPrice = BigInt('100000000000')
export const maxGasPerTx = BigInt('625000')
export const defaultGasFee = gasPrice * maxGasPerTx

export async function buildProject(): Promise<void> {
  if (typeof Project.currentProject === 'undefined') {
    await Project.build({ ignoreUnusedConstantsWarnings: true })
  }
}

export class ContractFixture<T extends Fields> {
  selfState: ContractState<T>
  dependencies: ContractState[]
  address: string
  contractId: string

  states(): ContractState[] {
    return this.dependencies.concat([this.selfState])
  }

  constructor(selfState: ContractState<T>, dependencies: ContractState[]) {
    this.selfState = selfState
    this.dependencies = dependencies
    this.address = selfState.address
    this.contractId = selfState.contractId
  }
}

export function createMath() {
  const address = randomContractAddress()
  const contractState = MathTest.stateForTest({}, undefined, address)
  return new ContractFixture(contractState, [])
}

export class GuardianSet {
  privateKeys: string[]
  index: number
  addresses: string[]

  constructor(keys: string[], index: number, addresses: string[]) {
    this.privateKeys = keys
    this.index = index
    this.addresses = addresses
  }

  static random(size: number, index: number): GuardianSet {
    const accounts = Array(size)
      .fill(0)
      .map(() => new ethers.Wallet(ethers.utils.randomBytes(32)))
    const addresses = accounts.map((account) => account.address.slice(2)) // drop the 0x prefix
    const pks = accounts.map((account) => account.privateKey)
    return new GuardianSet(pks, index, addresses)
  }

  encodeAddresses(): string {
    const sizeHex = zeroPad(this.addresses.length.toString(16), 1)
    return sizeHex + this.addresses.join('')
  }

  size(): number {
    return this.privateKeys.length
  }

  quorumSize(): number {
    return Math.floor((Math.floor((this.size() * 10) / 3) * 2) / 10) + 1
  }

  sign(size: number, body: VAABody): VAA {
    const keys = this.privateKeys
      .map((_, index) => [Math.random(), index])
      .sort((a, b) => a[0] - b[0])
      .slice(0, size)
      .sort((a, b) => a[1] - b[1])
    const hash = ethers.utils.keccak256(ethers.utils.keccak256('0x' + binToHex(body.encode())))
    const signatures = keys.map((element) => {
      const keyIndex = element[1]
      const ec = new elliptic.ec('secp256k1')
      const key = ec.keyFromPrivate(this.privateKeys[`${keyIndex}`].slice(2))
      const sig = key.sign(hash.slice(2), { canonical: true })
      const signature = [
        zeroPad(sig.r.toString(16), 32),
        zeroPad(sig.s.toString(16), 32),
        zeroPad((sig.recoveryParam as number).toString(16), 1)
      ].join('')
      const buffer = Buffer.allocUnsafe(66)
      buffer.writeUint8(keyIndex, 0)
      buffer.write(signature, 1, 'hex')
      return buffer
    })
    return new VAA(1, this.index, signatures, body)
  }
}

export class VAABody {
  timestamp: number // seconds
  nonce: string
  emitterChainId: number
  targetChainId: number
  emitterAddress: string
  sequence: number
  consistencyLevel: number
  payload: Uint8Array

  constructor(
    payload: Uint8Array,
    emitterChainId: number,
    targetChainId: number,
    emitterAddress: string,
    sequence: number,
    timestamp = 0,
    nonceHex: string = nonce(),
    consistencyLevel = 0
  ) {
    this.timestamp = timestamp
    this.nonce = nonceHex
    this.emitterChainId = emitterChainId
    this.targetChainId = targetChainId
    this.emitterAddress = emitterAddress
    this.sequence = sequence
    this.consistencyLevel = consistencyLevel
    this.payload = payload
  }

  encode(): Uint8Array {
    const header = Buffer.allocUnsafe(53)
    header.writeUint32BE(this.timestamp, 0)
    header.write(this.nonce, 4, 'hex')
    header.writeUint16BE(this.emitterChainId, 8)
    header.writeUint16BE(this.targetChainId, 10)
    header.write(this.emitterAddress, 12, 'hex')
    header.writeBigUInt64BE(BigInt(this.sequence), 44)
    header.writeUint8(this.consistencyLevel, 52)
    return Buffer.concat([header, this.payload])
  }
}

export class VAA {
  version: number
  guardianSetIndex: number
  signatures: Uint8Array[]
  body: VAABody

  constructor(version: number, guardianSetIndex: number, signatures: Uint8Array[], body: VAABody) {
    this.version = version
    this.guardianSetIndex = guardianSetIndex
    this.signatures = signatures
    this.body = body
  }

  encode(): Uint8Array {
    const signatureSize = this.signatures.length
    const header = Buffer.allocUnsafe(6)
    header.writeUint8(this.version, 0)
    header.writeUint32BE(this.guardianSetIndex, 1)
    header.writeUint8(signatureSize, 5)
    return Buffer.concat([header, Buffer.concat(this.signatures), this.body.encode()])
  }
}

export class ContractUpgrade {
  contractCode: string
  prevStateHash?: string
  immutableState?: string
  mutableState?: string

  constructor(contractCode: string, prevStateHash?: string, immutableState?: string, mutableState?: string) {
    this.contractCode = contractCode
    this.prevStateHash = prevStateHash
    this.immutableState = immutableState
    this.mutableState = mutableState
  }

  encode(module: string, action: number) {
    const contractCodeLength = this.contractCode.length / 2
    const buffer0 = Buffer.allocUnsafe(32 + 1 + 2 + contractCodeLength)
    buffer0.write(module, 0, 'hex')
    buffer0.writeUint8(action, 32)
    buffer0.writeUint16BE(contractCodeLength, 33)
    buffer0.write(this.contractCode, 35, 'hex')
    if (this.immutableState !== undefined && this.mutableState !== undefined) {
      const immutableStateLength = this.immutableState.length / 2
      const mutableStateLength = this.mutableState.length / 2
      const buffer1 = Buffer.allocUnsafe(32 + 2 + immutableStateLength + 2 + mutableStateLength)
      buffer1.write(this.prevStateHash as string, 0, 'hex')
      buffer1.writeUint16BE(immutableStateLength, 32)
      buffer1.write(this.immutableState, 34, 'hex')
      const offset = 34 + immutableStateLength
      buffer1.writeUint16BE(mutableStateLength, offset)
      buffer1.write(this.mutableState, offset + 2, 'hex')
      return Buffer.concat([buffer0, buffer1])
    }
    return buffer0
  }
}

export function randomByte32Hex(): string {
  return binToHex(randomBytes(32))
}

export function hexToBase58(hex: string): string {
  return base58.encode(Buffer.from(hex, 'hex'))
}

export function randomAssetAddressHex(): string {
  const generator = [randomP2PKHAddressHex, () => randomP2MPKHAddressHex(3, 5), randomP2SHAddressHex]
  const index = Math.floor(Math.random() * 2)
  return generator[`${index}`]()
}

export function randomAssetAddress(): string {
  return base58.encode(Buffer.from(randomAssetAddressHex(), 'hex'))
}

export function randomP2PKHAddressHex(): string {
  return '00' + randomByte32Hex()
}

export function randomP2MPKHAddressHex(m: number, n: number): string {
  let hex: string = '01' + binToHex(encodeI256(BigInt(n)))
  for (let i = 0; i < n; i += 1) {
    hex += randomByte32Hex()
  }
  return hex + binToHex(encodeI256(BigInt(m)))
}

export function randomP2SHAddressHex(): string {
  return '02' + randomByte32Hex()
}

export function randomP2CAddressHex(): string {
  return '03' + randomByte32Hex()
}

export function randomContractId(): string {
  return binToHex(contractIdFromAddress(randomContractAddress()))
}

export function randomContractAddress(): string {
  const prefix = Buffer.from([0x03])
  const bytes = Buffer.concat([prefix, randomBytes(32)])
  return base58.encode(bytes)
}

export function alph(n: number): bigint {
  return oneAlph * BigInt(n)
}

export function encodeU256(value: bigint): Uint8Array {
  return Buffer.from(zeroPad(value.toString(16), 32), 'hex')
}

export function encodeUint8(value: number): Uint8Array {
  return Buffer.from([value & 0xff])
}

async function expectFailed<T>(func: () => Promise<T>, details: string[]) {
  try {
    await func()
  } catch (err) {
    const message = (err as Error).message
    expect(details.some((e) => message.indexOf(e) !== -1)).toEqual(true)
  }
}

export async function expectAssertionFailed<T>(func: () => Promise<T>) {
  await expectFailed(func, ['AssertionFailed', 'AssertionFailedWithErrorCode'])
}

export async function expectNotEnoughBalance<T>(func: () => Promise<T>) {
  await expectFailed(func, ['NotEnoughApprovedBalance'])
}

export async function expectOneOfError<T>(func: () => Promise<T>, errors: string[]) {
  await expectFailed(func, errors)
}

export async function expectError<T>(func: () => Promise<T>, error: string) {
  await expectFailed(func, [error])
}

export function chainIdToBytes(chainId: number): Uint8Array {
  return Buffer.from(zeroPad(chainId.toString(16), 2), 'hex')
}

export function getContractState<T extends Fields>(contracts: ContractState[], idOrAddress: string): ContractState<T> {
  return contracts.find((c) => c.contractId === idOrAddress || c.address === idOrAddress)! as ContractState<T>
}

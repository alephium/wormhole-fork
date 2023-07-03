import { stringToHex, ContractState } from '@alephium/web3'
import { zeroPad } from '../../lib/utils'
import { CHAIN_ID_ALEPHIUM, ContractFixture, GuardianSet, randomContractAddress } from './wormhole-fixture'
import { Governance, GovernanceTypes, TokenBridgeFactoryTypes } from '../../artifacts/ts'
import { createTemplateContracts, createTokenBridgeFactory, TemplateContracts } from './token-bridge-fixture'

export const governanceModule = zeroPad(stringToHex('Core'), 32)
export const initGuardianSet = GuardianSet.random(12, 0)
export const governanceChainId = 0
export const governanceEmitterAddress = '0000000000000000000000000000000000000000000000000000000000000004'
export const defaultMessageFee = 10n ** 14n

// Doc: https://github.com/certusone/wormhole/blob/dev.v2/whitepapers/0002_governance_messaging.md
export class GuardianSetUpgrade {
  newGuardianSet: GuardianSet

  constructor(guardianSet: GuardianSet) {
    this.newGuardianSet = guardianSet
  }

  encode(): Uint8Array {
    const buffer = Buffer.allocUnsafe(38 + this.newGuardianSet.addresses.length * 20)
    buffer.write(governanceModule, 0, 'hex')
    buffer.writeUint8(2, 32) // actionId
    buffer.writeUint32BE(this.newGuardianSet.index, 33)
    buffer.writeUint8(this.newGuardianSet.size(), 37)

    let index = 38
    this.newGuardianSet.addresses.forEach((address) => {
      buffer.write(address, index, 'hex')
      index += 20
    })
    return buffer
  }
}

export class SetMessageFee {
  newMessageFee: bigint

  constructor(messageFee: bigint) {
    this.newMessageFee = messageFee
  }

  encode(): Uint8Array {
    const buffer = Buffer.allocUnsafe(65)
    buffer.write(governanceModule, 0, 'hex')
    buffer.writeUint8(3, 32) // actionId
    buffer.write(zeroPad(this.newMessageFee.toString(16), 32), 33, 'hex')
    return buffer
  }
}

export class SubmitTransferFee {
  recipient: string
  amount: bigint

  constructor(recipient: string, amount: bigint) {
    this.recipient = recipient
    this.amount = amount
  }

  encode() {
    const buffer = Buffer.allocUnsafe(97)
    buffer.write(governanceModule, 0, 'hex')
    buffer.writeUint8(4, 32) // actionId
    buffer.write(zeroPad(this.amount.toString(16), 32), 33, 'hex')
    buffer.write(this.recipient, 65, 'hex')
    return buffer
  }
}

export class GovernanceFixture extends ContractFixture<GovernanceTypes.Fields> {
  templateContracts: TemplateContracts
  tokenBridgeFactory: ContractFixture<TokenBridgeFactoryTypes.Fields>

  constructor(
    selfState: ContractState<GovernanceTypes.Fields>,
    dependencies: ContractState[],
    templateContracts: TemplateContracts,
    tokenBridgeFactory: ContractFixture<TokenBridgeFactoryTypes.Fields>
  ) {
    super(selfState, dependencies)
    this.templateContracts = templateContracts
    this.tokenBridgeFactory = tokenBridgeFactory
  }
}

export function createGovernanceWithGuardianSets(gs0: GuardianSet, gs1: GuardianSet): GovernanceTypes.Fields {
  return {
    chainId: BigInt(CHAIN_ID_ALEPHIUM),
    governanceChainId: BigInt(governanceChainId),
    governanceEmitterAddress: governanceEmitterAddress,
    tokenBridgeFactory: '',
    receivedSequence: 0n,
    messageFee: defaultMessageFee,
    guardianSets: [gs0.encodeAddresses(), gs1.encodeAddresses()],
    guardianSetIndexes: [BigInt(gs0.index), BigInt(gs1.index)],
    previousGuardianSetExpirationTimeMS: BigInt(Date.now())
  }
}

export function createGovernance(receivedSequence?: bigint, messageFee?: bigint, contractAddress?: string) {
  const templateContracts = createTemplateContracts()
  const tokenBridgeFactory = createTokenBridgeFactory(templateContracts)
  const address = contractAddress ?? randomContractAddress()
  const initFields: GovernanceTypes.Fields = {
    chainId: BigInt(CHAIN_ID_ALEPHIUM),
    governanceChainId: BigInt(governanceChainId),
    governanceEmitterAddress: governanceEmitterAddress,
    tokenBridgeFactory: tokenBridgeFactory.contractId,
    receivedSequence: receivedSequence ?? 0n,
    messageFee: messageFee ?? defaultMessageFee,
    guardianSets: ['', initGuardianSet.encodeAddresses()],
    guardianSetIndexes: [0n, BigInt(initGuardianSet.index)],
    previousGuardianSetExpirationTimeMS: 0n
  }
  const contractState = Governance.stateForTest(initFields, undefined, address)
  return new GovernanceFixture(contractState, tokenBridgeFactory.states(), templateContracts, tokenBridgeFactory)
}

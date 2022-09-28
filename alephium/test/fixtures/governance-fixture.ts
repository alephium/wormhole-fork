import { Project, stringToHex } from '@alephium/web3'
import { zeroPad } from '../../lib/utils'
import { CHAIN_ID_ALEPHIUM, ContractInfo, initAsset, GuardianSet, randomContractAddress } from './wormhole-fixture'

export const governanceModule = zeroPad(stringToHex('Core'), 32)
export const initGuardianSet = GuardianSet.random(12, 0)
export const governanceChainId = 0
export const governanceEmitterAddress = '0000000000000000000000000000000000000000000000000000000000000004'
export const messageFee = BigInt('100000000000000')

// Doc: https://github.com/certusone/wormhole/blob/dev.v2/whitepapers/0002_governance_messaging.md
export class UpdateGuardianSet {
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

export function createGovernance(): ContractInfo {
  const address = randomContractAddress()
  const governanceContract = Project.contract('Governance')
  const initFields = {
    chainId: CHAIN_ID_ALEPHIUM,
    governanceChainId: governanceChainId,
    governanceEmitterAddress: governanceEmitterAddress,
    receivedSequence: 0,
    messageFee: messageFee,
    guardianSets: ['', initGuardianSet.encodeAddresses()],
    guardianSetIndexes: [0, initGuardianSet.index],
    previousGuardianSetExpirationTimeMS: 0
  }
  const contractState = governanceContract.toState(initFields, initAsset, address)
  return new ContractInfo(governanceContract, contractState, [], address)
}

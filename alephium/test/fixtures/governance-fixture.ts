import { NodeProvider, Contract } from '@alephium/web3'
import { zeroPad } from '../../lib/utils'
import { CHAIN_ID_ALEPHIUM, ContractInfo, initAsset, GuardianSet, randomContractAddress, randomAssetAddress, randomContractId } from './wormhole-fixture'

export const governanceModule = "00000000000000000000000000000000000000000000000000000000436f7265"
export const initGuardianSet = GuardianSet.random(12, 0)
export const governanceChainId = 0
export const governanceEmitterAddress = '0000000000000000000000000000000000000000000000000000000000000004'
export const messageFee = BigInt("100000000000000")

export class UpdateGuardianSet {
    newGuardianSet: GuardianSet

    constructor(guardianSet: GuardianSet) {
        this.newGuardianSet = guardianSet
    }

    encode(chainId: number): Uint8Array {
        const buffer = Buffer.allocUnsafe(40 + this.newGuardianSet.addresses.length * 20)
        buffer.write(governanceModule, 0, 'hex')
        buffer.writeUint8(2, 32) // actionId
        buffer.writeUint16BE(chainId, 33)
        buffer.writeUint32BE(this.newGuardianSet.index, 35)
        buffer.writeUint8(this.newGuardianSet.size(), 39)

        let index = 40
        this.newGuardianSet.addresses.forEach(address => {
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

    encode(chainId: number): Uint8Array {
        const buffer = Buffer.allocUnsafe(67)
        buffer.write(governanceModule, 0, 'hex')
        buffer.writeUint8(3, 32) // actionId
        buffer.writeUint16BE(chainId, 33)
        buffer.write(zeroPad(this.newMessageFee.toString(16), 32), 35, 'hex')
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

    encode(chainId: number) {
        const buffer = Buffer.allocUnsafe(99)
        buffer.write(governanceModule, 0, 'hex')
        buffer.writeUint8(4, 32) // actionId
        buffer.writeUint16BE(chainId, 33)
        buffer.write(zeroPad(this.amount.toString(16), 32), 35, 'hex')
        buffer.write(this.recipient, 67, 'hex')
        return buffer
    }
}

export async function createGovernance(provider: NodeProvider): Promise<ContractInfo> {
    const address = randomContractAddress()
    const governanceContract = await Contract.fromSource(provider, 'governance.ral')
    const initFields = {
        'chainId': CHAIN_ID_ALEPHIUM,
        'governanceChainId': governanceChainId,
        'governanceEmitterAddress': governanceEmitterAddress,
        'receivedSequence': 0,
        'messageFee': messageFee,
        'guardianSets': Array('', initGuardianSet.encodeAddresses()),
        'guardianSetIndexes': [0, initGuardianSet.index],
        'previousGuardianSetExpirationTime': 0
    }
    const contractState = governanceContract.toState(initFields, initAsset, address)
    return new ContractInfo(governanceContract, contractState, [], address)
}

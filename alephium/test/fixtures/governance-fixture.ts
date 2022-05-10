import { CliqueClient, Contract } from 'alephium-web3'
import { zeroPad } from '../../lib/utils'
import { createUndoneSequence } from './sequence-fixture'
import { alphChainId, ContractInfo, dustAmount, GuardianSet, randomContractAddress } from './wormhole-fixture'

const governanceModule = "00000000000000000000000000000000000000000000000000000000436f7265"
export const initGuardianSet = GuardianSet.random(12, 0)
export const governanceChainId = 0
export const governanceContractAddress = '0000000000000000000000000000000000000000000000000000000000000004'
export const messageFee = BigInt("100000000000000")

export class UpdateGuardianSet {
    newGuardianSet: GuardianSet

    constructor(guardianSet: GuardianSet) {
        this.newGuardianSet = guardianSet
    }

    encode(chainId: number): Uint8Array {
        let header = Buffer.allocUnsafe(40)
        header.write(governanceModule, 0, 'hex')
        header.writeUint8(2, 32) // actionId
        header.writeUint16BE(chainId, 33)
        header.writeUint32BE(this.newGuardianSet.index, 35)
        header.writeUint8(this.newGuardianSet.size(), 39)
        let addresses = this.newGuardianSet.addresses().map(address => Buffer.from(address.slice(2), 'hex'))
        return Buffer.concat([
            header,
            Buffer.concat(addresses)
        ])
    }
}

export class SetMessageFee {
    newMessageFee: bigint

    constructor(messageFee: bigint) {
        this.newMessageFee = messageFee
    }

    encode(chainId: number): Uint8Array {
        let buffer = Buffer.allocUnsafe(67)
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
        let buffer = Buffer.allocUnsafe(99)
        buffer.write(governanceModule, 0, 'hex')
        buffer.writeUint8(4, 32) // actionId
        buffer.writeUint16BE(chainId, 33)
        buffer.write(zeroPad(this.amount.toString(16), 32), 35, 'hex')
        buffer.write(this.recipient, 67, 'hex')
        return buffer
    }
}

export async function createGovernance(
    client: CliqueClient,
    eventEmitter: ContractInfo
): Promise<ContractInfo> {
    const address = randomContractAddress()
    const undoneSequenceInfo = await createUndoneSequence(client, address)
    const governanceContract = await Contract.fromSource(client, 'governance.ral')
    const initFields = [
        alphChainId,
        governanceChainId,
        governanceContractAddress,
        0,
        0,
        0,
        undoneSequenceInfo.contractId,
        messageFee,
        Array(Array(19).fill('00'), initGuardianSet.guardianSetAddresses(19)),
        [0, initGuardianSet.index],
        [0, initGuardianSet.size()],
        0,
        undoneSequenceInfo.codeHash,
        eventEmitter.selfState.contractId,
    ]
    const contractState = governanceContract.toState(
        initFields,
        {alphAmount: dustAmount},
        address
    )
    return new ContractInfo(
        governanceContract,
        contractState,
        [undoneSequenceInfo.selfState, eventEmitter.selfState],
        address
    )
}

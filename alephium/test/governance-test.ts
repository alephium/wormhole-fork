import { Asset, CliqueClient, Contract, InputAsset, TestContractResult } from 'alephium-js'
import { toHex, zeroPad } from '../lib/utils'
import { alphChainId, dustAmount, expectAssertionFailed, governanceChainId, governanceContractAddress, GuardianSet, messageFee, oneAlph, randomAssetAddress, randomContractAddress, toContractId, VAA, VAABody } from './fixtures/wormhole-fixture'
import * as elliptic  from 'elliptic'
import { randomBytes } from 'crypto'
import * as base58 from 'bs58'

describe("test governance", () => {
    const client = new CliqueClient({baseUrl: `http://127.0.0.1:22973`})
    const module = "00000000000000000000000000000000000000000000000000000000436f7265"
    const initGuardianSet = GuardianSet.random(12, 0)
    const governanceAddress = randomContractAddress()
    const sequenceAddress = randomContractAddress()

    class UpdateGuardianSet {
        newGuardianSet: GuardianSet

        constructor(guardianSet: GuardianSet) {
            this.newGuardianSet = guardianSet
        }

        encode(chainId: number): Uint8Array {
            let header = Buffer.allocUnsafe(40)
            header.write(module, 0, 'hex')
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

    async function testCase(vaa: VAA, method: string, initialAsset?: Asset, inputAssets?: InputAsset[]): Promise<TestContractResult> {
        const sequenceContract = await Contract.from(client, 'sequence.ral')
        const contractState = sequenceContract.toState(
            [toContractId(governanceAddress), 0, Array(20).fill(0), Array(20).fill(0)],
            {alphAmount: dustAmount},
            sequenceAddress
        )
        const governanceContract = await Contract.from(client, 'governance.ral', {
            sequenceCodeHash: sequenceContract.codeHash
        })
        const initFields = [
            alphChainId,
            governanceChainId,
            governanceContractAddress,
            true,
            sequenceAddress,
            messageFee,
            Array(Array(19).fill('00'), initGuardianSet.guardianSetAddresses(19)),
            [0, initGuardianSet.index],
            [0, initGuardianSet.size()],
            0
        ]
        return await governanceContract.test(client, method, {
            initialFields: initFields,
            address: governanceAddress,
            existingContracts: [contractState],
            testArgs: [toHex(vaa.encode())],
            initialAsset: initialAsset,
            inputAssets: inputAssets
        })
    }

    it('should update guardian set', async () => {
        const updateGuardianSet = new UpdateGuardianSet(GuardianSet.random(18, 1))
        const vaaBody = new VAABody(updateGuardianSet.encode(alphChainId), governanceChainId, governanceContractAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const testResult = await testCase(vaa, 'updateGuardianSet')
        const governanceState = testResult.contracts[1]
        expect(governanceState.fields[6]).toEqual(Array(
            initGuardianSet.guardianSetAddresses(19).map(str => str.toLowerCase()),
            updateGuardianSet.newGuardianSet.guardianSetAddresses(19).map(str => str.toLowerCase())
        ))
        expect(governanceState.fields[7]).toEqual(Array(initGuardianSet.index, updateGuardianSet.newGuardianSet.index))
        expect(governanceState.fields[8]).toEqual(Array(initGuardianSet.size(), updateGuardianSet.newGuardianSet.size()))
    })

    it('should failed if signature is not enough', async () => {
        const updateGuardianSet = new UpdateGuardianSet(GuardianSet.random(18, 1))
        const vaaBody = new VAABody(updateGuardianSet.encode(alphChainId), governanceChainId, governanceContractAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize() - 1, vaaBody)
        expectAssertionFailed(async () => {
            return await testCase(vaa, 'updateGuardianSet')
        })
    })

    it('should failed if signature is duplicated', async () => {
        const updateGuardianSet = new UpdateGuardianSet(GuardianSet.random(18, 1))
        const vaaBody = new VAABody(updateGuardianSet.encode(alphChainId), governanceChainId, governanceContractAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const invalidSignatures = Array(vaa.signatures.length).fill(vaa.signatures[0])
        const invalidVaa = new VAA(vaa.version, vaa.guardianSetIndex, invalidSignatures, vaa.body)
        expectAssertionFailed(async () => {
            return await testCase(invalidVaa, 'updateGuardianSet')
        })
    })

    it('should failed if signature is invalid', async () => {
        const updateGuardianSet = new UpdateGuardianSet(GuardianSet.random(18, 1))
        const vaaBody = new VAABody(updateGuardianSet.encode(alphChainId), governanceChainId, governanceContractAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const invalidSignatures = Array(vaa.signatures.length).fill(0).map(_ => randomBytes(66))
        const invalidVaa = new VAA(vaa.version, vaa.guardianSetIndex, invalidSignatures, vaa.body)
        expectAssertionFailed(async () => {
            return await testCase(invalidVaa, 'updateGuardianSet')
        })
    })

    class SetMessageFee {
        newMessageFee: bigint

        constructor(messageFee: bigint) {
            this.newMessageFee = messageFee
        }

        encode(chainId: number): Uint8Array {
            let buffer = Buffer.allocUnsafe(67)
            buffer.write(module, 0, 'hex')
            buffer.writeUint8(3, 32) // actionId
            buffer.writeUint16BE(chainId, 33)
            buffer.write(zeroPad(this.newMessageFee.toString(16), 32), 35, 'hex')
            return buffer
        }
    }

    it('should set message fee', async () => {
        const setMessageFee = new SetMessageFee(messageFee * 2n)
        const vaaBody = new VAABody(setMessageFee.encode(alphChainId), governanceChainId, governanceContractAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const testResult = await testCase(vaa, 'setMessageFee')
        const governanceState = testResult.contracts[1]
        expect(governanceState.fields[5]).toEqual(Number(setMessageFee.newMessageFee))
    })

    class SubmitTransferFee {
        recipient: string
        amount: bigint

        constructor(recipient: string, amount: bigint) {
            this.recipient = recipient
            this.amount = amount
        }

        encode(chainId: number) {
            let buffer = Buffer.allocUnsafe(99)
            buffer.write(module, 0, 'hex')
            buffer.writeUint8(4, 32) // actionId
            buffer.writeUint16BE(chainId, 33)
            buffer.write(zeroPad(this.amount.toString(16), 32), 35, 'hex')
            buffer.write(this.recipient, 67, 'hex')
            return buffer
        }
    }

    it('should transfer message fee to recipient', async () => {
        const asset: Asset = {
            alphAmount: messageFee * 1000n
        }
        const inputAsset: InputAsset = {
            address: randomAssetAddress(),
            asset: {
                alphAmount: oneAlph * 4n
            }
        }
        const recipient = randomBytes(32)
        const amount = messageFee * 20n
        const submitTransferFee = new SubmitTransferFee(toHex(recipient), amount)
        const vaaBody = new VAABody(submitTransferFee.encode(alphChainId), governanceChainId, governanceContractAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const testResult = await testCase(vaa, 'submitTransferFee', asset, [inputAsset])
        const assetOutput = testResult.txOutputs[0]
        expect(assetOutput.type).toEqual("AssetOutput")
        expect(assetOutput.address).toEqual(base58.encode(Buffer.concat([Buffer.from([0x00]), recipient])))
        expect(BigInt(assetOutput.alphAmount)).toEqual(amount)

        const contractOutput = testResult.txOutputs[1]
        expect(contractOutput.type).toEqual("ContractOutput")
        expect(contractOutput.address).toEqual(governanceAddress)
        expect(contractOutput.alphAmount).toEqual(BigInt(asset.alphAmount) - amount)
    })
})

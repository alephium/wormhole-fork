import { Asset, CliqueClient, InputAsset, TestContractResult, Val } from 'alephium-web3'
import { toHex } from '../lib/utils'
import { alphChainId, ContractUpgrade, createEventEmitter, encodeU256, expectAssertionFailed, expectAssertionFailedOrRecoverEthAddressFailed, GuardianSet, oneAlph, randomAssetAddress, VAA, VAABody } from './fixtures/wormhole-fixture'
import { randomBytes } from 'crypto'
import * as base58 from 'bs58'
import { createGovernance, governanceChainId, governanceContractAddress, governanceModule, initGuardianSet, messageFee, SetMessageFee, SubmitTransferFee, UpdateGuardianSet } from './fixtures/governance-fixture'
import * as blake from 'blakejs'

describe("test governance", () => {
    const client = new CliqueClient({baseUrl: `http://127.0.0.1:22973`})

    async function testCase(vaa: VAA, method: string, initialAsset?: Asset, inputAssets?: InputAsset[]): Promise<TestContractResult> {
        const eventEmitter = await createEventEmitter(client)
        const governanceInfo = await createGovernance(client, eventEmitter)
        const contract = governanceInfo.contract
        return await contract.testPublicMethod(client, method, {
            initialFields: governanceInfo.selfState.fields,
            address: governanceInfo.address,
            existingContracts: governanceInfo.dependencies,
            testArgs: [toHex(vaa.encode())],
            initialAsset: initialAsset,
            inputAssets: inputAssets
        })
    }

    test('should update guardian set', async () => {
        const updateGuardianSet = new UpdateGuardianSet(GuardianSet.random(18, 1))
        const vaaBody = new VAABody(updateGuardianSet.encode(alphChainId), governanceChainId, governanceContractAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const testResult = await testCase(vaa, 'updateGuardianSet')
        const governanceState = testResult.contracts[2]
        expect(governanceState.fields[8]).toEqual(Array(
            initGuardianSet.guardianSetAddresses(19).map(str => str.toLowerCase()),
            updateGuardianSet.newGuardianSet.guardianSetAddresses(19).map(str => str.toLowerCase())
        ))
        expect(governanceState.fields[9]).toEqual(Array(initGuardianSet.index, updateGuardianSet.newGuardianSet.index))
        expect(governanceState.fields[10]).toEqual(Array(initGuardianSet.size(), updateGuardianSet.newGuardianSet.size()))
    }, 10000)

    it('should failed if signature is not enough', async () => {
        const updateGuardianSet = new UpdateGuardianSet(GuardianSet.random(18, 1))
        const vaaBody = new VAABody(updateGuardianSet.encode(alphChainId), governanceChainId, governanceContractAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize() - 1, vaaBody)
        await expectAssertionFailed(async () => {
            return await testCase(vaa, 'updateGuardianSet')
        })
    })

    it('should failed if signature is duplicated', async () => {
        const updateGuardianSet = new UpdateGuardianSet(GuardianSet.random(18, 1))
        const vaaBody = new VAABody(updateGuardianSet.encode(alphChainId), governanceChainId, governanceContractAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const invalidSignatures = Array(vaa.signatures.length).fill(vaa.signatures[0])
        const invalidVaa = new VAA(vaa.version, vaa.guardianSetIndex, invalidSignatures, vaa.body)
        await expectAssertionFailed(async () => {
            return await testCase(invalidVaa, 'updateGuardianSet')
        })
    })

    it('should failed if signature is invalid', async () => {
        const updateGuardianSet = new UpdateGuardianSet(GuardianSet.random(18, 1))
        const vaaBody = new VAABody(updateGuardianSet.encode(alphChainId), governanceChainId, governanceContractAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const invalidSignatures = Array(vaa.signatures.length).fill(0).map(_ => randomBytes(66))
        const invalidVaa = new VAA(vaa.version, vaa.guardianSetIndex, invalidSignatures, vaa.body)
        await expectAssertionFailedOrRecoverEthAddressFailed(async () => {
            return await testCase(invalidVaa, 'updateGuardianSet')
        })
    })

    it('should set message fee', async () => {
        const setMessageFee = new SetMessageFee(messageFee * 2n)
        const vaaBody = new VAABody(setMessageFee.encode(alphChainId), governanceChainId, governanceContractAddress, 0)
        const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
        const testResult = await testCase(vaa, 'setMessageFee')
        const governanceState = testResult.contracts[2]
        expect(governanceState.fields[7]).toEqual(Number(setMessageFee.newMessageFee))
    })

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
        const governanceState = testResult.contracts[2]
        expect(contractOutput.type).toEqual("ContractOutput")
        expect(contractOutput.address).toEqual(governanceState.address)
        expect(contractOutput.alphAmount).toEqual(BigInt(asset.alphAmount) - amount)
    })

    it('should test upgrade contract', async () => {
        const eventEmitter = await createEventEmitter(client)
        const governanceInfo = await createGovernance(client, eventEmitter)
        const contract = governanceInfo.contract
        async function upgrade(contractUpgrade: ContractUpgrade): Promise<TestContractResult> {
            const vaaBody = new VAABody(contractUpgrade.encode(governanceModule, 1, alphChainId), governanceChainId, governanceContractAddress, 0)
            const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
            return await contract.testPublicMethod(client, 'upgradeContract', {
                initialFields: governanceInfo.selfState.fields,
                address: governanceInfo.address,
                existingContracts: governanceInfo.dependencies,
                testArgs: [toHex(vaa.encode())],
            }, governanceInfo.templateVariables)
        }

        {
            const newContractCode = "40330106010000000000"
            const contractUpgrade = new ContractUpgrade(newContractCode)
            const testResult = await upgrade(contractUpgrade)
            const newContract = testResult.contracts[testResult.contracts.length-1]
            expect(newContract.address).toEqual(governanceInfo.address)
            expect(newContract.bytecode).toEqual(newContractCode)
        }

        {
            await expectAssertionFailed(async () => {
                const newContractCode = "000106010000000000"
                const prevStateHash = randomBytes(32).toString('hex')
                const newState = "00"
                const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, newState)
                await upgrade(contractUpgrade)
            })
        }

        {
            const next = governanceInfo.selfState.fields[3] as bigint
            const next1 = governanceInfo.selfState.fields[4] as bigint
            const next2 = governanceInfo.selfState.fields[5] as bigint
            const guardianSetIndexes = governanceInfo.selfState.fields[9] as Val[]
            const guardianSetIndex0 = guardianSetIndexes[0] as bigint
            const guardianSetIndex1 = guardianSetIndexes[1] as bigint
            const prevEncodedState = Buffer.concat([
                encodeU256(next), encodeU256(BigInt(next1) + 1n), encodeU256(next2),
                encodeU256(guardianSetIndex0), encodeU256(guardianSetIndex1)
            ])
            const prevStateHash = Buffer.from(blake.blake2b(prevEncodedState, undefined, 32)).toString('hex')
            const newContractCode = "000106010000000000"
            const newState = "00"
            const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, newState)
            const testResult = await upgrade(contractUpgrade)
            const newContract = testResult.contracts[testResult.contracts.length-1]
            expect(newContract.address).toEqual(governanceInfo.address)
            expect(newContract.bytecode).toEqual(newContractCode)
            expect(newContract.fields).toEqual([])
        }
    })
})

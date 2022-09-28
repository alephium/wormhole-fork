import { Asset, InputAsset, TestContractResult, Val, binToHex, Project, web3 } from '@alephium/web3'
import {
  CHAIN_ID_ALEPHIUM,
  ContractUpgrade,
  encodeU256,
  expectAssertionFailed,
  expectOneOfError,
  GuardianSet,
  oneAlph,
  randomAssetAddress,
  VAA,
  VAABody,
  buildProject
} from './fixtures/wormhole-fixture'
import { randomBytes } from 'crypto'
import * as base58 from 'bs58'
import {
  createGovernance,
  governanceChainId,
  governanceEmitterAddress,
  governanceModule,
  initGuardianSet,
  messageFee,
  SetMessageFee,
  SubmitTransferFee,
  UpdateGuardianSet
} from './fixtures/governance-fixture'
import * as blake from 'blakejs'

describe('test governance', () => {
  web3.setCurrentNodeProvider('http://127.0.0.1:22973')
  const testGuardianSet = GuardianSet.random(18, 1)

  async function testCase(
    vaa: VAA,
    method: string,
    initialAsset?: Asset,
    inputAssets?: InputAsset[]
  ): Promise<TestContractResult> {
    await buildProject()
    const governanceInfo = createGovernance()
    const contract = governanceInfo.contract
    return await contract.testPublicMethod(method, {
      initialFields: governanceInfo.selfState.fields,
      address: governanceInfo.address,
      existingContracts: governanceInfo.dependencies,
      testArgs: { vaa: binToHex(vaa.encode()) },
      initialAsset: initialAsset,
      inputAssets: inputAssets
    })
  }

  it('should update guardian set succeed if target chain id is valid', async () => {
    const updateGuardianSet = new UpdateGuardianSet(testGuardianSet)
    const validChainIds = [CHAIN_ID_ALEPHIUM, 0]
    for (const chainId of validChainIds) {
      const vaaBody = new VAABody(updateGuardianSet.encode(), governanceChainId, chainId, governanceEmitterAddress, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      const testResult = await testCase(vaa, 'submitNewGuardianSet')
      const governanceState = testResult.contracts[0]
      expect(governanceState.fields['guardianSets']).toEqual([
        initGuardianSet.encodeAddresses().toLowerCase(),
        updateGuardianSet.newGuardianSet.encodeAddresses().toLowerCase()
      ])
      expect(governanceState.fields['guardianSetIndexes']).toEqual([
        initGuardianSet.index,
        updateGuardianSet.newGuardianSet.index
      ])
    }
  })

  it('should update guardian set failed if target chain id is invalid', async () => {
    const updateGuardianSet = new UpdateGuardianSet(testGuardianSet)
    const invalidChainIds = [CHAIN_ID_ALEPHIUM + 1, CHAIN_ID_ALEPHIUM - 1]
    for (const chainId of invalidChainIds) {
      const vaaBody = new VAABody(updateGuardianSet.encode(), governanceChainId, chainId, governanceEmitterAddress, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      await expectAssertionFailed(async () => {
        return await testCase(vaa, 'submitNewGuardianSet')
      })
    }
  })

  it('should update guardian set failed if sequence is invalid', async () => {
    const updateGuardianSet = new UpdateGuardianSet(testGuardianSet)
    const invalidSequenceVaaBody = new VAABody(
      updateGuardianSet.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      1
    )
    const invalidSequenceVaa = initGuardianSet.sign(initGuardianSet.quorumSize(), invalidSequenceVaaBody)
    await expectAssertionFailed(async () => {
      await testCase(invalidSequenceVaa, 'submitNewGuardianSet')
    })
  })

  it('should update guardian set failed if new guardian set is empty', async () => {
    const emptyGuardianSet = new GuardianSet([], 1, [])
    const updateGuardianSet = new UpdateGuardianSet(emptyGuardianSet)
    const vaaBody = new VAABody(updateGuardianSet.encode(), governanceChainId, 0, governanceEmitterAddress, 0)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    await expectAssertionFailed(async () => {
      await testCase(vaa, 'submitNewGuardianSet')
    })
  })

  it('should failed if signature is not enough', async () => {
    const updateGuardianSet = new UpdateGuardianSet(testGuardianSet)
    const vaaBody = new VAABody(
      updateGuardianSet.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize() - 1, vaaBody)
    await expectAssertionFailed(async () => {
      return await testCase(vaa, 'submitNewGuardianSet')
    })
  })

  it('should failed if signature is duplicated', async () => {
    const updateGuardianSet = new UpdateGuardianSet(testGuardianSet)
    const vaaBody = new VAABody(
      updateGuardianSet.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const invalidSignatures = Array(vaa.signatures.length).fill(vaa.signatures[0])
    const invalidVaa = new VAA(vaa.version, vaa.guardianSetIndex, invalidSignatures, vaa.body)
    await expectAssertionFailed(async () => {
      return await testCase(invalidVaa, 'submitNewGuardianSet')
    })
  })

  it('should failed if signature is invalid', async () => {
    const updateGuardianSet = new UpdateGuardianSet(testGuardianSet)
    const vaaBody = new VAABody(
      updateGuardianSet.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const invalidSignatures = Array(vaa.signatures.length)
      .fill(0)
      .map((_) => randomBytes(66))
    const invalidVaa = new VAA(vaa.version, vaa.guardianSetIndex, invalidSignatures, vaa.body)
    await expectOneOfError(
      async () => await testCase(invalidVaa, 'submitNewGuardianSet'),
      ['AssertionFailed', 'FailedInRecoverEthAddress', 'InvalidConversion', 'InvalidBytesSliceArg']
    )
  })

  it('should set message fee', async () => {
    const setMessageFee = new SetMessageFee(messageFee * 2n)
    const vaaBody = new VAABody(
      setMessageFee.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const testResult = await testCase(vaa, 'submitSetMessageFee')
    const governanceState = testResult.contracts[0]
    expect(governanceState.fields['messageFee']).toEqual(Number(setMessageFee.newMessageFee))
  })

  it('should transfer message fee to recipient', async () => {
    const asset: Asset = {
      alphAmount: oneAlph * 4n
    }
    const inputAsset: InputAsset = {
      address: randomAssetAddress(),
      asset: {
        alphAmount: oneAlph * 4n
      }
    }
    const recipient = randomBytes(32)
    const amount = messageFee * 20n
    const submitTransferFee = new SubmitTransferFee(binToHex(recipient), amount)
    const vaaBody = new VAABody(
      submitTransferFee.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const testResult = await testCase(vaa, 'submitTransferFees', asset, [inputAsset])
    const assetOutput = testResult.txOutputs[0]
    expect(assetOutput.type).toEqual('AssetOutput')
    expect(assetOutput.address).toEqual(base58.encode(Buffer.concat([Buffer.from([0x00]), recipient])))
    expect(BigInt(assetOutput.alphAmount)).toEqual(amount)

    const contractOutput = testResult.txOutputs[1]
    const governanceState = testResult.contracts[0]
    expect(contractOutput.type).toEqual('ContractOutput')
    expect(contractOutput.address).toEqual(governanceState.address)
    expect(contractOutput.alphAmount).toEqual(BigInt(asset.alphAmount) - amount)
  })

  it('should test upgrade contract', async () => {
    await buildProject()
    const governanceInfo = createGovernance()
    const contract = governanceInfo.contract
    async function upgrade(contractUpgrade: ContractUpgrade): Promise<TestContractResult> {
      const vaaBody = new VAABody(
        contractUpgrade.encode(governanceModule, 1),
        governanceChainId,
        CHAIN_ID_ALEPHIUM,
        governanceEmitterAddress,
        0
      )
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      return await contract.testPublicMethod('submitContractUpgrade', {
        initialFields: governanceInfo.selfState.fields,
        address: governanceInfo.address,
        existingContracts: governanceInfo.dependencies,
        testArgs: { vaa: binToHex(vaa.encode()) }
      })
    }

    {
      const v1 = Project.contract('GovernanceV1')
      const newContractCode = v1.bytecode
      const contractUpgrade = new ContractUpgrade(newContractCode)
      const testResult = await upgrade(contractUpgrade)
      const newContract = testResult.contracts[testResult.contracts.length - 1]
      expect(newContract.address).toEqual(governanceInfo.address)
      expect(newContract.bytecode).toEqual(newContractCode)
    }

    const v2 = Project.contract('Empty')
    {
      await expectAssertionFailed(async () => {
        const newContractCode = v2.bytecode
        const prevStateHash = randomBytes(32).toString('hex')
        const newState = '00'
        const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, newState)
        await upgrade(contractUpgrade)
      })
    }

    {
      const receivedSequence = governanceInfo.selfState.fields['receivedSequence'] as bigint
      const messageFee = governanceInfo.selfState.fields['messageFee'] as bigint
      const guardianSetIndexes = governanceInfo.selfState.fields['guardianSetIndexes'] as Val[]
      const guardianSetIndex0 = guardianSetIndexes[0] as bigint
      const guardianSetIndex1 = guardianSetIndexes[1] as bigint
      const prevEncodedState = Buffer.concat([
        encodeU256(BigInt(receivedSequence) + 1n),
        encodeU256(messageFee),
        encodeU256(guardianSetIndex0),
        encodeU256(guardianSetIndex1)
      ])
      const prevStateHash = Buffer.from(blake.blake2b(prevEncodedState, undefined, 32)).toString('hex')
      const newContractCode = v2.bytecode
      const newState = '00'
      const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, newState)
      const testResult = await upgrade(contractUpgrade)
      const newContract = testResult.contracts[testResult.contracts.length - 1]
      expect(newContract.address).toEqual(governanceInfo.address)
      expect(newContract.bytecode).toEqual(newContractCode)
      expect(newContract.fields).toEqual({})
    }
  })
})

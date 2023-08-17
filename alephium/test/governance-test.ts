import {
  Asset,
  InputAsset,
  TestContractResult,
  binToHex,
  Project,
  web3,
  TestContractParams,
  HexString
} from '@alephium/web3'
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
  buildProject,
  getContractState,
  randomContractAddress
} from './fixtures/wormhole-fixture'
import { randomBytes } from 'crypto'
import * as base58 from 'bs58'
import {
  createGovernance,
  governanceChainId,
  governanceEmitterAddress,
  governanceModule,
  initGuardianSet,
  defaultMessageFee,
  SetMessageFee,
  SubmitTransferFee,
  GuardianSetUpgrade,
  createGovernanceWithGuardianSets
} from './fixtures/governance-fixture'
import * as blake from 'blakejs'
import { Governance, GovernanceTypes } from '../artifacts/ts'
import { expectAssertionError } from '@alephium/web3-test'

describe('test governance', () => {
  const testGuardianSet = GuardianSet.random(18, 1)
  const governanceContractAddress = randomContractAddress()

  beforeAll(async () => {
    web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)
    await buildProject()
  })

  function createTestParams(
    vaa: VAA,
    initialAsset?: Asset,
    inputAssets?: InputAsset[],
    receivedSequence?: bigint
  ): TestContractParams<GovernanceTypes.Fields, { vaa: HexString }> {
    const governanceFixture = createGovernance(receivedSequence, undefined, governanceContractAddress)
    return {
      initialFields: governanceFixture.selfState.fields,
      address: governanceFixture.address,
      existingContracts: governanceFixture.dependencies,
      testArgs: { vaa: binToHex(vaa.encode()) },
      initialAsset: initialAsset,
      inputAssets: inputAssets
    }
  }

  it('should fail if uses unknown guardian set', async () => {
    const setMessageFee = new SetMessageFee(defaultMessageFee * 2n)
    const vaaBody = new VAABody(
      setMessageFee.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )

    const gs0 = GuardianSet.random(3, 0) // invalid guardian set
    const gs1 = GuardianSet.random(3, 1)
    const gs2 = GuardianSet.random(5, 2)
    const governanceAddress = randomContractAddress()
    const initialFields = createGovernanceWithGuardianSets(gs1, gs2)

    async function test(gs: GuardianSet) {
      const vaa = gs.sign(gs.quorumSize(), vaaBody)
      return Governance.tests.parseAndVerifyVAA({
        initialFields,
        address: governanceAddress,
        testArgs: { data: binToHex(vaa.encode()), isGovernanceVAA: false },
        blockTimeStamp: Number(initialFields.previousGuardianSetExpirationTimeMS)
      })
    }

    await expectAssertionError(
      test(gs0),
      governanceAddress,
      Number(Governance.consts.ErrorCodes.InvalidGuardianSetIndex)
    )
    await test(gs1)
    await test(gs2)
  })

  it('should fail if uses invalid guardian set to validate vaa', async () => {
    const setMessageFee = new SetMessageFee(defaultMessageFee * 2n)
    const vaaBody = new VAABody(
      setMessageFee.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )

    const gs0 = GuardianSet.random(3, 0)
    const gs1 = GuardianSet.random(5, 1)
    const governanceAddress = randomContractAddress()
    const initialFields = createGovernanceWithGuardianSets(gs0, gs1)

    async function test(gs: GuardianSet, blockTimeStamp?: number, isGovernanceVAA = false) {
      const vaa = gs.sign(gs.quorumSize(), vaaBody)
      return Governance.tests.parseAndVerifyVAA({
        initialFields: initialFields,
        address: governanceAddress,
        testArgs: { data: binToHex(vaa.encode()), isGovernanceVAA },
        blockTimeStamp
      })
    }

    await expectAssertionError(
      test(gs0, Number(initialFields.previousGuardianSetExpirationTimeMS), true),
      governanceAddress,
      Number(Governance.consts.ErrorCodes.InvalidGuardianSetIndex)
    )
    await test(gs1, undefined, true)

    await expectAssertionError(
      test(gs0, Number(initialFields.previousGuardianSetExpirationTimeMS) + 1),
      governanceAddress,
      Number(Governance.consts.ErrorCodes.GuardianSetExpired)
    )
    await test(gs0, Number(initialFields.previousGuardianSetExpirationTimeMS))
    await test(gs0, Number(initialFields.previousGuardianSetExpirationTimeMS) - 1)
    await test(gs1, Number(initialFields.previousGuardianSetExpirationTimeMS) + 1)
    await test(gs1, Number(initialFields.previousGuardianSetExpirationTimeMS))
    await test(gs1, Number(initialFields.previousGuardianSetExpirationTimeMS) - 1)
  })

  it('should update guardian set succeed if target chain id is valid', async () => {
    const guardianSetUpgrade = new GuardianSetUpgrade(testGuardianSet)
    const validChainIds = [CHAIN_ID_ALEPHIUM, 0]
    for (const chainId of validChainIds) {
      const vaaBody = new VAABody(guardianSetUpgrade.encode(), governanceChainId, chainId, governanceEmitterAddress, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      const testResult = await Governance.tests.submitNewGuardianSet(createTestParams(vaa))
      const governanceState = getContractState<GovernanceTypes.Fields>(testResult.contracts, governanceContractAddress)
      expect(governanceState.fields.guardianSets).toEqual([
        initGuardianSet.encodeAddresses().toLowerCase(),
        guardianSetUpgrade.newGuardianSet.encodeAddresses().toLowerCase()
      ])
      expect(governanceState.fields.guardianSetIndexes).toEqual([
        BigInt(initGuardianSet.index),
        BigInt(guardianSetUpgrade.newGuardianSet.index)
      ])
    }
  })

  it('should update guardian set failed if target chain id is invalid', async () => {
    const guardianSetUpgrade = new GuardianSetUpgrade(testGuardianSet)
    const invalidChainIds = [CHAIN_ID_ALEPHIUM + 1, CHAIN_ID_ALEPHIUM - 1]
    for (const chainId of invalidChainIds) {
      const vaaBody = new VAABody(guardianSetUpgrade.encode(), governanceChainId, chainId, governanceEmitterAddress, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      await expectAssertionFailed(async () => {
        return await Governance.tests.submitNewGuardianSet(createTestParams(vaa))
      })
    }
  })

  it('should update guardian set failed if sequence is invalid', async () => {
    const guardianSetUpgrade = new GuardianSetUpgrade(testGuardianSet)
    async function test(sequence: number) {
      const body = new VAABody(
        guardianSetUpgrade.encode(),
        governanceChainId,
        CHAIN_ID_ALEPHIUM,
        governanceEmitterAddress,
        sequence
      )
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), body)
      await Governance.tests.submitNewGuardianSet(createTestParams(vaa, undefined, undefined, 3n))
    }
    for (let seq = 0; seq < 3; seq += 1) {
      await expectAssertionFailed(async () => await test(seq))
    }
    for (let seq = 3; seq < 10; seq += 3) {
      // we have checked the results in previous tests
      await test(seq)
    }
  }, 10000)

  it('should update guardian set failed if new guardian set is empty', async () => {
    const emptyGuardianSet = new GuardianSet([], 1, [])
    const guardianSetUpgrade = new GuardianSetUpgrade(emptyGuardianSet)
    const vaaBody = new VAABody(guardianSetUpgrade.encode(), governanceChainId, 0, governanceEmitterAddress, 0)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    await expectAssertionFailed(async () => {
      await Governance.tests.submitNewGuardianSet(createTestParams(vaa))
    })
  })

  it('should fail if signature is not enough', async () => {
    const guardianSetUpgrade = new GuardianSetUpgrade(testGuardianSet)
    const vaaBody = new VAABody(
      guardianSetUpgrade.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize() - 1, vaaBody)
    await expectAssertionFailed(async () => {
      await Governance.tests.submitNewGuardianSet(createTestParams(vaa))
    })
  })

  it('should fail if signature is duplicated', async () => {
    const guardianSetUpgrade = new GuardianSetUpgrade(testGuardianSet)
    const vaaBody = new VAABody(
      guardianSetUpgrade.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const invalidSignatures = Array(vaa.signatures.length).fill(vaa.signatures[0])
    const invalidVaa = new VAA(vaa.version, vaa.guardianSetIndex, invalidSignatures, vaa.body)
    await expectAssertionFailed(async () => {
      await Governance.tests.submitNewGuardianSet(createTestParams(invalidVaa))
    })
  })

  it('should fail if signature is invalid', async () => {
    const guardianSetUpgrade = new GuardianSetUpgrade(testGuardianSet)
    const vaaBody = new VAABody(
      guardianSetUpgrade.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const invalidSignatures = Array(vaa.signatures.length)
      .fill(0)
      .map(() => randomBytes(66))
    const invalidVaa = new VAA(vaa.version, vaa.guardianSetIndex, invalidSignatures, vaa.body)
    await expectOneOfError(
      async () => await Governance.tests.submitNewGuardianSet(createTestParams(invalidVaa)),
      ['AssertionFailed', 'FailedInRecoverEthAddress', 'InvalidConversion', 'InvalidBytesSliceArg']
    )
  })

  it('should set message fee', async () => {
    const setMessageFee = new SetMessageFee(defaultMessageFee * 2n)
    const vaaBody = new VAABody(
      setMessageFee.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const testResult = await Governance.tests.submitSetMessageFee(createTestParams(vaa))
    const governanceState = getContractState<GovernanceTypes.Fields>(testResult.contracts, governanceContractAddress)
    expect(governanceState.fields.messageFee).toEqual(setMessageFee.newMessageFee)
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
    const amount = defaultMessageFee * 20n
    const submitTransferFee = new SubmitTransferFee(binToHex(recipient), amount)
    const vaaBody = new VAABody(
      submitTransferFee.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const testResult = await Governance.tests.submitTransferFees(createTestParams(vaa, asset, [inputAsset]))
    const assetOutput = testResult.txOutputs[0]
    expect(assetOutput.type).toEqual('AssetOutput')
    expect(assetOutput.address).toEqual(base58.encode(Buffer.concat([Buffer.from([0x00]), recipient])))
    expect(BigInt(assetOutput.alphAmount)).toEqual(amount)

    const contractOutput = testResult.txOutputs.find((o) => o.address === governanceContractAddress)!
    const governanceState = getContractState<GovernanceTypes.Fields>(testResult.contracts, governanceContractAddress)
    expect(contractOutput.type).toEqual('ContractOutput')
    expect(contractOutput.address).toEqual(governanceState.address)
    expect(contractOutput.alphAmount).toEqual(BigInt(asset.alphAmount) - amount)
  })

  it('should test upgrade contract', async () => {
    await buildProject()
    const governanceFixture = createGovernance(undefined, undefined, governanceContractAddress)
    async function upgrade(contractUpgrade: ContractUpgrade): Promise<TestContractResult<null>> {
      const vaaBody = new VAABody(
        contractUpgrade.encode(governanceModule, 1),
        governanceChainId,
        CHAIN_ID_ALEPHIUM,
        governanceEmitterAddress,
        0
      )
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      return await Governance.tests.submitContractUpgrade({
        initialFields: governanceFixture.selfState.fields,
        address: governanceFixture.address,
        existingContracts: governanceFixture.dependencies,
        testArgs: { vaa: binToHex(vaa.encode()) }
      })
    }

    {
      const v1 = Project.contract('GovernanceV1')
      const newContractCode = v1.bytecode
      const contractUpgrade = new ContractUpgrade(newContractCode)
      const testResult = await upgrade(contractUpgrade)
      const newContract = getContractState<GovernanceTypes.Fields>(testResult.contracts, governanceContractAddress)
      expect(newContract.address).toEqual(governanceFixture.address)
      expect(newContract.bytecode).toEqual(newContractCode)
    }

    const v2 = Project.contract('Empty')
    {
      await expectAssertionFailed(async () => {
        const newContractCode = v2.bytecode
        const prevStateHash = randomBytes(32).toString('hex')
        const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, '010200', '010201')
        await upgrade(contractUpgrade)
      })
    }

    {
      const receivedSequence = governanceFixture.selfState.fields.receivedSequence
      const messageFee = governanceFixture.selfState.fields.messageFee
      const guardianSetIndexes = governanceFixture.selfState.fields.guardianSetIndexes
      const prevEncodedState = Buffer.concat([
        encodeU256(BigInt(receivedSequence) + 1n),
        encodeU256(messageFee),
        encodeU256(guardianSetIndexes[0]),
        encodeU256(guardianSetIndexes[1])
      ])
      const prevStateHash = Buffer.from(blake.blake2b(prevEncodedState, undefined, 32)).toString('hex')
      const newContractCode = v2.bytecode
      const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, '010200', '010201')
      const testResult = await upgrade(contractUpgrade)
      const newContract = getContractState<GovernanceTypes.Fields>(testResult.contracts, governanceContractAddress)
      expect(newContract.address).toEqual(governanceFixture.address)
      expect(newContract.bytecode).toEqual(newContractCode)
      expect(newContract.fields).toEqual({ a: 0n, b: 1n })
    }
  }, 10000)
})

import {
  Asset,
  InputAsset,
  TestContractResult,
  Token,
  ContractState,
  contractIdFromAddress,
  binToHex,
  Project,
  web3,
  subContractId,
  ALPH_TOKEN_ID,
  ContractDestroyedEvent,
  ONE_ALPH
} from '@alephium/web3'
import { nonce, zeroPad } from '../lib/utils'
import {
  governanceChainId,
  governanceEmitterAddress,
  initGuardianSet,
  defaultMessageFee
} from './fixtures/governance-fixture'
import {
  AttestToken,
  attestTokenHandlerAddress,
  createAttestTokenHandler,
  createBridgeRewardRouter,
  createTestToken,
  createTokenBridge,
  createTokenBridgeForChain,
  DestroyUnexecutedSequenceContracts,
  expectAssetsEqual,
  minimalConsistencyLevel,
  newLocalTokenPoolTestFixture,
  newRemoteTokenPoolTestFixture,
  newTokenBridgeForChainTestFixture,
  RegisterChain,
  tokenBridgeForChainAddress,
  tokenBridgeModule,
  tokenPoolAddress,
  Transfer,
  UpdateMinimalConsistencyLevel,
  UpdateRefundAddress
} from './fixtures/token-bridge-fixture'
import {
  CHAIN_ID_ALEPHIUM,
  ContractUpgrade,
  minimalAlphInContract,
  encodeU256,
  expectAssertionFailed,
  oneAlph,
  tokenMax,
  VAABody,
  dustAmount,
  defaultGasFee,
  randomContractId,
  randomContractAddress,
  expectNotEnoughBalance,
  alph,
  buildProject,
  expectError,
  encodeUint8,
  hexToBase58,
  randomAssetAddress,
  randomByte32Hex,
  randomAssetAddressHex,
  randomP2PKHAddressHex,
  randomP2MPKHAddressHex,
  randomP2SHAddressHex,
  randomP2CAddressHex,
  getContractState,
  ContractFixture
} from './fixtures/wormhole-fixture'
import { randomBytes } from 'crypto'
import * as blake from 'blakejs'
import { createUnexecutedSequence } from './fixtures/sequence-fixture'
import * as base58 from 'bs58'
import {
  AttestTokenHandler,
  AttestTokenHandlerTypes,
  BridgeRewardRouter,
  Empty,
  GovernanceTypes,
  LocalTokenPoolTypes,
  RemoteTokenPool,
  RemoteTokenPoolTypes,
  TokenBridge,
  TokenBridgeForChain,
  TokenBridgeForChainTypes,
  TokenBridgeTypes,
  TokenBridgeV1,
  UnexecutedSequenceTypes
} from '../artifacts/ts'

describe('test token bridge', () => {
  web3.setCurrentNodeProvider('http://127.0.0.1:22973', undefined, fetch)

  const payer = randomAssetAddress()
  const defaultInputAsset: InputAsset = alphInputAsset(payer, alph(4))

  function checkTxCallerBalance(assets: Asset[], spent: bigint, tokens: Token[] = []) {
    const tokenDustAmount = BigInt(tokens.length) * dustAmount
    const remain = BigInt(defaultInputAsset.asset.alphAmount) - defaultGasFee - spent - tokenDustAmount
    const tokenAssets = tokens.map((token) => {
      return { alphAmount: dustAmount, tokens: [token] }
    })
    expectAssetsEqual(assets, [...tokenAssets, { alphAmount: remain, tokens: [] }])
  }

  function alphAndTokenAsset(alphAmount: bigint, tokenId: string, tokenAmount: bigint): Asset {
    return { alphAmount: alphAmount, tokens: [{ id: tokenId, amount: tokenAmount }] }
  }

  function alphAndTokenInputAsset(
    fromAddress: string,
    alphAmount: bigint,
    tokenId: string,
    tokenAmount: bigint
  ): InputAsset {
    return { address: fromAddress, asset: alphAndTokenAsset(alphAmount, tokenId, tokenAmount) }
  }

  function alphInputAsset(fromAddress: string, alphAmount: bigint): InputAsset {
    return { address: fromAddress, asset: { alphAmount: alphAmount } }
  }

  function stringToBytes32Hex(symbol: string): string {
    return Buffer.from(symbol, 'utf8').toString('hex').padEnd(64, '0')
  }

  function removeTrailingZeroHex(str: string): string {
    let result = str
    while (result.endsWith('00')) result = result.slice(0, -2)
    return result
  }

  const decimals = 8
  const symbol = stringToBytes32Hex('TT')
  const name = stringToBytes32Hex('TestToken')
  const remoteChainId = CHAIN_ID_ALEPHIUM + 1
  const remoteTokenBridgeId = randomByte32Hex()

  it('should attest token', async () => {
    await buildProject()
    const tokenBridge = createTokenBridge()
    const testToken = createTestToken()
    const nonceHex = nonce()
    const inputAsset = alphAndTokenInputAsset(payer, alph(2), testToken.contractId, 1n)
    const testResult = await TokenBridge.tests.attestToken({
      address: tokenBridge.address,
      initialFields: tokenBridge.selfState.fields,
      testArgs: {
        payer: payer,
        localTokenId: testToken.contractId,
        decimals: BigInt(decimals),
        symbol: symbol,
        name: name,
        nonce: nonceHex,
        consistencyLevel: 0n
      },
      inputAssets: [inputAsset],
      existingContracts: tokenBridge.dependencies.concat(testToken.states())
    })
    const governanceOutput = testResult.txOutputs[0]
    expect(governanceOutput.address).toEqual(tokenBridge.governance.address)
    expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + defaultMessageFee))

    const message = new AttestToken(testToken.contractId, CHAIN_ID_ALEPHIUM, symbol, name, decimals)
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0] as GovernanceTypes.WormholeMessageEvent
    expect(event.name).toEqual('WormholeMessage')
    expect(event.fields).toEqual({
      sender: tokenBridge.contractId,
      targetChainId: 0n,
      sequence: 0n,
      nonce: nonceHex,
      payload: binToHex(message.encode()),
      consistencyLevel: 0n
    })
  })

  it('should attest alph', async () => {
    await buildProject()
    const tokenBridge = createTokenBridge()
    const nonceHex = nonce()
    const inputAsset = alphInputAsset(payer, alph(2))
    const testResult = await TokenBridge.tests.attestToken({
      address: tokenBridge.address,
      initialFields: tokenBridge.selfState.fields,
      testArgs: {
        payer: payer,
        localTokenId: ALPH_TOKEN_ID,
        decimals: BigInt(decimals),
        symbol: symbol,
        name: name,
        nonce: nonceHex,
        consistencyLevel: 0n
      },
      inputAssets: [inputAsset],
      existingContracts: tokenBridge.dependencies
    })
    const governanceOutput = testResult.txOutputs[0]
    expect(governanceOutput.address).toEqual(tokenBridge.governance.address)
    expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + defaultMessageFee))

    const message = new AttestToken(ALPH_TOKEN_ID, CHAIN_ID_ALEPHIUM, symbol, name, decimals)
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0] as GovernanceTypes.WormholeMessageEvent
    expect(event.name).toEqual('WormholeMessage')
    expect(event.fields).toEqual({
      sender: tokenBridge.contractId,
      targetChainId: 0n,
      sequence: 0n,
      nonce: nonceHex,
      payload: binToHex(message.encode()),
      consistencyLevel: 0n
    })
  })

  it('should update minimal consistency level', async () => {
    await buildProject()
    const tokenBridge = createTokenBridge()
    const newMinimalConsistencyLevel = 5
    const message = new UpdateMinimalConsistencyLevel(newMinimalConsistencyLevel)
    const vaaBody = new VAABody(message.encode(), governanceChainId, CHAIN_ID_ALEPHIUM, governanceEmitterAddress, 0)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const testResult = await TokenBridge.tests.updateMinimalConsistencyLevel({
      address: tokenBridge.address,
      initialFields: tokenBridge.selfState.fields,
      testArgs: { vaa: binToHex(vaa.encode()) },
      inputAssets: [defaultInputAsset],
      existingContracts: tokenBridge.dependencies
    })

    const tokenBridgeState = getContractState<TokenBridgeTypes.Fields>(testResult.contracts, tokenBridge.contractId)
    expect(tokenBridgeState.fields.minimalConsistencyLevel).toEqual(BigInt(newMinimalConsistencyLevel))
  })

  it('should register chain', async () => {
    await buildProject()
    const tokenBridge = createTokenBridge()
    const registerChain = new RegisterChain(remoteChainId, remoteTokenBridgeId)
    const vaaBody = new VAABody(
      registerChain.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const testResult = await TokenBridge.tests.registerChain({
      address: tokenBridge.address,
      initialFields: tokenBridge.selfState.fields,
      testArgs: {
        vaa: binToHex(vaa.encode()),
        payer: payer,
        createContractAlphAmount: minimalAlphInContract
      },
      inputAssets: [defaultInputAsset],
      existingContracts: tokenBridge.dependencies
    })

    const output0 = testResult.txOutputs[0]
    expect(output0.address).toEqual(attestTokenHandlerAddress(tokenBridge.contractId, remoteChainId))
    expect(output0.alphAmount).toEqual(minimalAlphInContract)
    const output1 = testResult.txOutputs[1]
    expect(output1.address).toEqual(tokenBridgeForChainAddress(tokenBridge.contractId, remoteChainId))
    expect(output1.alphAmount).toEqual(minimalAlphInContract)
  })

  it('should register chain failed if sequence is invalid', async () => {
    await buildProject()
    const tokenBridge = createTokenBridge(undefined, 3n)
    const registerChain = new RegisterChain(remoteChainId, randomContractId())
    async function test(sequence: number) {
      const vaaBody = new VAABody(
        registerChain.encode(),
        governanceChainId,
        CHAIN_ID_ALEPHIUM,
        governanceEmitterAddress,
        sequence
      )
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      return TokenBridge.tests.registerChain({
        address: tokenBridge.address,
        initialFields: tokenBridge.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          payer: payer,
          createContractAlphAmount: minimalAlphInContract
        },
        inputAssets: [defaultInputAsset],
        existingContracts: tokenBridge.dependencies
      })
    }
    for (let seq = 0; seq < 3; seq += 1) {
      await expectAssertionFailed(async () => await test(seq))
    }
    for (let seq = 3; seq < 5; seq += 1) {
      // we have checked the results in previous tests
      await test(seq)
    }
  }, 10000)

  it('should create alph token pool', async () => {
    await buildProject()
    const tokenBridge = createTokenBridge()
    const localTokenBridgeId = tokenBridge.contractId

    async function testCreateAlphTokenPool(
      attestTokenHandler: ContractFixture<AttestTokenHandlerTypes.Fields>,
      targetChainId: number
    ) {
      const attestToken = new AttestToken(ALPH_TOKEN_ID, CHAIN_ID_ALEPHIUM, symbol, name, decimals)
      const vaaBody = new VAABody(attestToken.encode(), CHAIN_ID_ALEPHIUM, targetChainId, localTokenBridgeId, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      const inputAsset = alphInputAsset(payer, alph(3))
      const testResult = await AttestTokenHandler.tests.createLocalTokenPool({
        address: attestTokenHandler.address,
        initialFields: attestTokenHandler.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          payer: payer,
          createContractAlphAmount: minimalAlphInContract,
          tokenAmount: 1n
        },
        inputAssets: [inputAsset],
        existingContracts: tokenBridge.states()
      })

      const localTokenPoolAddress = tokenPoolAddress(localTokenBridgeId, CHAIN_ID_ALEPHIUM, ALPH_TOKEN_ID)
      const localTokenPoolState = getContractState<LocalTokenPoolTypes.Fields>(
        testResult.contracts,
        localTokenPoolAddress
      )
      expect(localTokenPoolState.fields.decimals_).toEqual(BigInt(decimals))

      const localTokenPoolOutput = testResult.txOutputs.find((o) => o.address === localTokenPoolAddress)!
      expect(localTokenPoolOutput.alphAmount).toEqual(minimalAlphInContract)
      expect(localTokenPoolOutput.tokens).toEqual([])
    }

    const attestTokenHandler = createAttestTokenHandler(tokenBridge, CHAIN_ID_ALEPHIUM, localTokenBridgeId)
    await testCreateAlphTokenPool(attestTokenHandler, 0)
    await expectAssertionFailed(async () => testCreateAlphTokenPool(attestTokenHandler, CHAIN_ID_ALEPHIUM))

    const invalidAttestTokenHandler = createAttestTokenHandler(tokenBridge, remoteChainId, remoteTokenBridgeId)
    await expectAssertionFailed(async () => testCreateAlphTokenPool(invalidAttestTokenHandler, 0))
    await expectAssertionFailed(async () => testCreateAlphTokenPool(invalidAttestTokenHandler, CHAIN_ID_ALEPHIUM))
  })

  it('should transfer alph to remote chain', async () => {
    await buildProject()
    const fromAddress = randomAssetAddress()
    const toAddress = randomByte32Hex()
    const transferAmount = oneAlph
    const nonceHex = nonce()
    const inputAsset = alphInputAsset(fromAddress, transferAmount * 2n)

    async function test(messageFee: bigint, arbiterFee: bigint) {
      const fixture = newLocalTokenPoolTestFixture(remoteChainId, remoteTokenBridgeId, ALPH_TOKEN_ID, messageFee)
      const testResult = await TokenBridge.tests.transferToken({
        address: fixture.tokenBridge.address,
        initialFields: fixture.tokenBridge.selfState.fields,
        testArgs: {
          fromAddress: fromAddress,
          bridgeTokenId: ALPH_TOKEN_ID,
          tokenChainId: BigInt(CHAIN_ID_ALEPHIUM),
          toChainId: BigInt(remoteChainId),
          toAddress: toAddress,
          tokenAmount: transferAmount,
          messageFee: messageFee,
          arbiterFee: arbiterFee,
          nonce: nonceHex,
          consistencyLevel: minimalConsistencyLevel
        },
        inputAssets: [inputAsset],
        existingContracts: fixture.localTokenPool.states()
      })

      const tokenBridgeForChainState = getContractState<TokenBridgeForChainTypes.Fields>(
        testResult.contracts,
        fixture.tokenBridgeForChain.contractId
      )
      expect(tokenBridgeForChainState.fields.sendSequence).toEqual(1n)

      // check `totalBridged`
      const tokenPoolState = getContractState<LocalTokenPoolTypes.Fields>(
        testResult.contracts,
        fixture.localTokenPool.contractId
      )
      expect(tokenPoolState.fields.totalBridged).toEqual(fixture.totalBridged + transferAmount)
      expect(tokenPoolState.asset.alphAmount).toEqual(fixture.totalBridged + transferAmount + minimalAlphInContract)

      const tokenPoolOutput = testResult.txOutputs.find((c) => c.address === fixture.localTokenPool.address)!
      expect(tokenPoolOutput.alphAmount).toEqual(fixture.totalBridged + transferAmount + minimalAlphInContract)
      expect(tokenPoolOutput.tokens).toEqual([])

      if (messageFee !== 0n) {
        const governanceOutput = testResult.txOutputs.find((c) => c.address === fixture.tokenBridge.governance.address)!
        expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + messageFee))
      }

      const transferMessage = new Transfer(transferAmount, ALPH_TOKEN_ID, CHAIN_ID_ALEPHIUM, toAddress, arbiterFee)
      expect(testResult.events.length).toEqual(1)
      const event = testResult.events[0] as GovernanceTypes.WormholeMessageEvent
      expect(event.name).toEqual('WormholeMessage')
      expect(event.fields).toEqual({
        sender: fixture.tokenBridge.contractId,
        targetChainId: BigInt(remoteChainId),
        sequence: 0n,
        nonce: nonceHex,
        payload: binToHex(transferMessage.encode()),
        consistencyLevel: minimalConsistencyLevel
      })
    }

    await test(0n, 0n)
    await test(0n, 10n ** 12n)
    await test(10n ** 14n, 0n)
    await test(10n ** 14n, 10n ** 12n)
  })

  it('should complete transfer alph', async () => {
    await buildProject()
    const fixture = newLocalTokenPoolTestFixture(remoteChainId, remoteTokenBridgeId, ALPH_TOKEN_ID)
    const toAddress = randomAssetAddressHex()
    const transferAmount = oneAlph

    async function test(arbiterFee: bigint) {
      const transfer = new Transfer(transferAmount, ALPH_TOKEN_ID, CHAIN_ID_ALEPHIUM, toAddress, arbiterFee)
      const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)

      const testResult = await TokenBridgeForChain.tests.completeTransfer({
        address: fixture.tokenBridgeForChain.address,
        initialFields: fixture.tokenBridgeForChain.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          caller: defaultInputAsset.address
        },
        initialAsset: fixture.tokenBridgeForChain.selfState.asset,
        inputAssets: [defaultInputAsset],
        existingContracts: fixture.localTokenPool.states()
      })

      // check `totalBridged`
      const tokenPoolState = getContractState<LocalTokenPoolTypes.Fields>(
        testResult.contracts,
        fixture.localTokenPool.contractId
      )
      expect(tokenPoolState.fields.totalBridged).toEqual(fixture.totalBridged - transferAmount)
      expect(tokenPoolState.asset.alphAmount).toEqual(fixture.totalBridged - transferAmount + minimalAlphInContract)

      const tokenBridgeForChainState = getContractState<TokenBridgeForChainTypes.Fields>(
        testResult.contracts,
        fixture.tokenBridgeForChain.contractId
      )
      expect(tokenBridgeForChainState.fields.firstNext256).toEqual(1n)

      const recipientOutput = testResult.txOutputs.find((c) => c.address === hexToBase58(toAddress))!
      expect(BigInt(recipientOutput.alphAmount)).toEqual(transferAmount - arbiterFee + dustAmount)

      const callerOutputs = testResult.txOutputs.filter((c) => c.address === defaultInputAsset.address)
      checkTxCallerBalance(callerOutputs, dustAmount - arbiterFee)

      const tokenPoolOutput = testResult.txOutputs.find((c) => c.address === fixture.localTokenPool.address)!
      expect(tokenPoolOutput.alphAmount).toEqual(fixture.totalBridged - transferAmount + minimalAlphInContract)
      expect(tokenPoolOutput.tokens).toEqual([])
    }

    await test(10n ** 12n)
    await test(0n)
  })

  it('should create local token pool', async () => {
    await buildProject()
    const fixture = createTokenBridge()
    const testToken = createTestToken()
    const localTokenBridgeId = fixture.contractId

    async function testCreateLocalTokenPool(
      attestTokenHandler: ContractFixture<AttestTokenHandlerTypes.Fields>,
      targetChainId: number
    ) {
      const attestToken = new AttestToken(testToken.contractId, CHAIN_ID_ALEPHIUM, symbol, name, decimals)
      const vaaBody = new VAABody(attestToken.encode(), CHAIN_ID_ALEPHIUM, targetChainId, localTokenBridgeId, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      const inputAsset = alphAndTokenInputAsset(payer, alph(2), testToken.contractId, 1n)
      const testResult = await AttestTokenHandler.tests.createLocalTokenPool({
        address: attestTokenHandler.address,
        initialFields: attestTokenHandler.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          payer: payer,
          createContractAlphAmount: minimalAlphInContract,
          tokenAmount: 1n
        },
        inputAssets: [inputAsset],
        existingContracts: fixture.states().concat(testToken.states())
      })

      const localTokenPoolAddress = tokenPoolAddress(localTokenBridgeId, CHAIN_ID_ALEPHIUM, testToken.contractId)
      const localTokenPoolState = getContractState<LocalTokenPoolTypes.Fields>(
        testResult.contracts,
        localTokenPoolAddress
      )
      expect(localTokenPoolState.fields.decimals_).toEqual(BigInt(decimals))

      const localTokenPoolOutput = testResult.txOutputs.find((o) => o.address === localTokenPoolAddress)!
      expect(localTokenPoolOutput.alphAmount).toEqual(minimalAlphInContract)
      expect(localTokenPoolOutput.tokens).toEqual([])
    }

    const attestTokenHandlerFixture = createAttestTokenHandler(fixture, CHAIN_ID_ALEPHIUM, localTokenBridgeId)
    await testCreateLocalTokenPool(attestTokenHandlerFixture, 0)
    await expectAssertionFailed(async () => testCreateLocalTokenPool(attestTokenHandlerFixture, CHAIN_ID_ALEPHIUM))

    const invalidAttestTokenHandlerFixture = createAttestTokenHandler(fixture, remoteChainId, remoteTokenBridgeId)
    await expectAssertionFailed(async () => testCreateLocalTokenPool(invalidAttestTokenHandlerFixture, 0))
    await expectAssertionFailed(async () =>
      testCreateLocalTokenPool(invalidAttestTokenHandlerFixture, CHAIN_ID_ALEPHIUM)
    )
  }, 10000)

  it('should transfer local token', async () => {
    await buildProject()
    const testToken = createTestToken()
    const fixture = newLocalTokenPoolTestFixture(remoteChainId, remoteTokenBridgeId, testToken.contractId)
    const fromAddress = randomAssetAddress()
    const toAddress = randomByte32Hex()
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const nonceHex = nonce()
    const inputAsset = alphAndTokenInputAsset(fromAddress, oneAlph, testToken.contractId, transferAmount)
    const testResult = await TokenBridge.tests.transferToken({
      address: fixture.tokenBridge.address,
      initialFields: fixture.tokenBridge.selfState.fields,
      testArgs: {
        fromAddress: fromAddress,
        bridgeTokenId: testToken.contractId,
        tokenChainId: BigInt(CHAIN_ID_ALEPHIUM),
        toChainId: BigInt(remoteChainId),
        toAddress: toAddress,
        tokenAmount: transferAmount,
        messageFee: defaultMessageFee,
        arbiterFee: arbiterFee,
        nonce: nonceHex,
        consistencyLevel: minimalConsistencyLevel
      },
      inputAssets: [inputAsset],
      existingContracts: fixture.localTokenPool.states().concat(testToken.states())
    })

    const tokenBridgeForChainState = getContractState<TokenBridgeForChainTypes.Fields>(
      testResult.contracts,
      fixture.tokenBridgeForChain.contractId
    )
    expect(tokenBridgeForChainState.fields.sendSequence).toEqual(1n)

    // check `totalBridged`
    const localTokenPoolState = getContractState<LocalTokenPoolTypes.Fields>(
      testResult.contracts,
      fixture.localTokenPool.contractId
    )
    expect(localTokenPoolState.fields.totalBridged).toEqual(fixture.totalBridged + transferAmount)

    const localTokenPoolOutput = testResult.txOutputs[0]
    expect(localTokenPoolOutput.tokens).toEqual([
      {
        id: testToken.contractId,
        amount: fixture.totalBridged + transferAmount
      }
    ])
    const governanceOutput = testResult.txOutputs[1]
    expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + defaultMessageFee))

    const transferMessage = new Transfer(transferAmount, testToken.contractId, CHAIN_ID_ALEPHIUM, toAddress, arbiterFee)
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0] as GovernanceTypes.WormholeMessageEvent
    expect(event.name).toEqual('WormholeMessage')
    expect(event.fields).toEqual({
      sender: fixture.tokenBridge.contractId,
      targetChainId: BigInt(remoteChainId),
      sequence: 0n,
      nonce: nonceHex,
      payload: binToHex(transferMessage.encode()),
      consistencyLevel: minimalConsistencyLevel
    })
  })

  it('should complete local token transfer', async () => {
    await buildProject()
    const testToken = createTestToken()
    const fixture = newLocalTokenPoolTestFixture(remoteChainId, remoteTokenBridgeId, testToken.contractId)
    const toAddressHex = randomAssetAddressHex()
    const toAddress = hexToBase58(toAddressHex)
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const transfer = new Transfer(transferAmount, testToken.contractId, CHAIN_ID_ALEPHIUM, toAddressHex, arbiterFee)
    const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 0)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)

    async function testWithCaller(inputAsset: InputAsset) {
      return TokenBridgeForChain.tests.completeTransfer({
        address: fixture.tokenBridgeForChain.address,
        initialFields: fixture.tokenBridgeForChain.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          caller: inputAsset.address
        },
        initialAsset: fixture.tokenBridgeForChain.selfState.asset,
        inputAssets: [inputAsset],
        existingContracts: fixture.localTokenPool.states().concat(testToken.states())
      })
    }

    const checkResult = (testResult: TestContractResult<null>) => {
      // check `totalBridged`
      const localTokenPoolState = getContractState<LocalTokenPoolTypes.Fields>(
        testResult.contracts,
        fixture.localTokenPool.contractId
      )
      expect(localTokenPoolState.fields.totalBridged).toEqual(fixture.totalBridged - transferAmount)

      const tokenBridgeForChainState = getContractState<TokenBridgeForChainTypes.Fields>(
        testResult.contracts,
        fixture.tokenBridgeForChain.contractId
      )
      expect(tokenBridgeForChainState.fields.firstNext256).toEqual(1n)

      const initAsset = fixture.localTokenPool.selfState.asset
      const contractOutput = testResult.txOutputs.find((c) => c.address === fixture.localTokenPool.address)!
      expect(contractOutput.alphAmount).toEqual(initAsset.alphAmount)
      expect(contractOutput.tokens).toEqual([
        {
          id: testToken.contractId,
          amount: fixture.totalBridged - transferAmount
        }
      ])
    }

    const testResult0 = await testWithCaller(defaultInputAsset)
    checkResult(testResult0)

    const recipientOutput0 = testResult0.txOutputs.find((c) => c.address === toAddress)!
    expect(BigInt(recipientOutput0.alphAmount)).toEqual(dustAmount)
    expect(recipientOutput0.tokens).toEqual([
      {
        id: testToken.contractId,
        amount: transferAmount - arbiterFee
      }
    ])

    const callerOutputs0 = testResult0.txOutputs.filter((c) => c.address === payer)
    checkTxCallerBalance(callerOutputs0, dustAmount, [
      {
        id: testToken.contractId,
        amount: arbiterFee
      }
    ])

    const testResult1 = await testWithCaller({
      address: toAddress,
      asset: { alphAmount: oneAlph }
    })
    checkResult(testResult1)

    const recipientOutputs1 = testResult1.txOutputs.filter((c) => c.address === toAddress)
    expectAssetsEqual(recipientOutputs1, [
      { alphAmount: dustAmount, tokens: [{ id: testToken.contractId, amount: transferAmount }] },
      { alphAmount: oneAlph - defaultGasFee - dustAmount, tokens: [] }
    ])
  })

  it('should create remote token pool', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const fixture = createTokenBridge()
    const localTokenBridgeId = fixture.contractId

    async function testCreateRemoteTokenPool(
      attestTokenHandler: ContractFixture<AttestTokenHandlerTypes.Fields>,
      targetChainId: number
    ) {
      const attestToken = new AttestToken(remoteTokenId, remoteChainId, symbol, name, decimals)
      const vaaBody = new VAABody(attestToken.encode(), remoteChainId, targetChainId, remoteTokenBridgeId, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      const result = await AttestTokenHandler.tests.createRemoteTokenPool({
        address: attestTokenHandler.address,
        initialFields: attestTokenHandler.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          payer: payer,
          createContractAlphAmount: minimalAlphInContract
        },
        inputAssets: [defaultInputAsset],
        existingContracts: fixture.states()
      })

      const remoteTokenPoolAddress = tokenPoolAddress(localTokenBridgeId, remoteChainId, remoteTokenId)
      const remoteTokenPoolState = getContractState<RemoteTokenPoolTypes.Fields>(
        result.contracts,
        remoteTokenPoolAddress
      )
      expect(remoteTokenPoolState.fields.decimals_).toEqual(BigInt(decimals))
      expect(remoteTokenPoolState.fields.symbol_).toEqual(removeTrailingZeroHex(symbol))
      expect(remoteTokenPoolState.fields.name_).toEqual(removeTrailingZeroHex(name))

      const remoteTokenPoolOutput = result.txOutputs.find((o) => o.address === remoteTokenPoolAddress)!
      expect(remoteTokenPoolOutput.alphAmount).toEqual(minimalAlphInContract)
      const remoteTokenPoolId = binToHex(contractIdFromAddress(remoteTokenPoolAddress))
      expect(remoteTokenPoolOutput.tokens).toEqual([{ id: remoteTokenPoolId, amount: tokenMax }])
    }

    const attestTokenHandler = createAttestTokenHandler(fixture, remoteChainId, remoteTokenBridgeId)
    await testCreateRemoteTokenPool(attestTokenHandler, 0)
    await expectAssertionFailed(async () => testCreateRemoteTokenPool(attestTokenHandler, CHAIN_ID_ALEPHIUM))

    const invalidAttestTokenHandler = createAttestTokenHandler(fixture, CHAIN_ID_ALEPHIUM, localTokenBridgeId)
    await expectAssertionFailed(async () => testCreateRemoteTokenPool(invalidAttestTokenHandler, 0))
    await expectAssertionFailed(async () => testCreateRemoteTokenPool(invalidAttestTokenHandler, CHAIN_ID_ALEPHIUM))
  }, 10000)

  it('should update remote token pool', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const fixture = newRemoteTokenPoolTestFixture(
      remoteChainId,
      remoteTokenBridgeId,
      remoteTokenId,
      symbol,
      name,
      decimals,
      1
    )
    const newSymbol = stringToBytes32Hex('TT0')
    const newName = stringToBytes32Hex('TestToken0')
    const newDecimals = decimals + 1
    // invalid caller
    expectError(
      async () =>
        await RemoteTokenPool.tests.updateDetails({
          address: fixture.remoteTokenPool.selfState.address,
          initialFields: fixture.remoteTokenPool.selfState.fields,
          testArgs: {
            symbol: newSymbol,
            name: newName,
            sequence: 2n
          },
          inputAssets: [defaultInputAsset],
          existingContracts: fixture.remoteTokenPool.dependencies
        }),
      'ExpectAContract'
    )

    async function update(
      attestTokenHandler: ContractFixture<AttestTokenHandlerTypes.Fields>,
      targetChainId: number,
      sequence: number
    ) {
      const attestToken = new AttestToken(remoteTokenId, remoteChainId, newSymbol, newName, newDecimals)
      const vaaBody = new VAABody(attestToken.encode(), remoteChainId, targetChainId, remoteTokenBridgeId, sequence)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      const result = await AttestTokenHandler.tests.updateRemoteTokenPool({
        address: attestTokenHandler.address,
        initialFields: attestTokenHandler.selfState.fields,
        testArgs: { vaa: binToHex(vaa.encode()) },
        inputAssets: [defaultInputAsset],
        existingContracts: fixture.remoteTokenPool.states()
      })

      const remoteTokenPoolState = getContractState<RemoteTokenPoolTypes.Fields>(
        result.contracts,
        fixture.remoteTokenPool.contractId
      )
      expect(remoteTokenPoolState.fields.symbol_).toEqual(removeTrailingZeroHex(newSymbol))
      expect(remoteTokenPoolState.fields.name_).toEqual(removeTrailingZeroHex(newName))
      expect(remoteTokenPoolState.fields.sequence_).toEqual(2n)
      expect(remoteTokenPoolState.fields.decimals_).toEqual(BigInt(decimals)) // decimals never change
    }

    const attestTokenHandlerInfo = createAttestTokenHandler(fixture.tokenBridge, remoteChainId, remoteTokenBridgeId)
    await update(attestTokenHandlerInfo, 0, 2)
    await expectAssertionFailed(async () => update(attestTokenHandlerInfo, CHAIN_ID_ALEPHIUM, 3)) // invalid chain id
    await expectAssertionFailed(async () => update(attestTokenHandlerInfo, 0, 1)) // invalid sequence
    await expectAssertionFailed(async () => update(attestTokenHandlerInfo, 0, 0)) // invalid sequence

    const invalidAttestTokenHandler = createAttestTokenHandler(
      fixture.tokenBridge,
      CHAIN_ID_ALEPHIUM,
      fixture.tokenBridge.contractId
    )
    await expectAssertionFailed(async () => update(invalidAttestTokenHandler, 0, 2))
    await expectAssertionFailed(async () => update(invalidAttestTokenHandler, CHAIN_ID_ALEPHIUM, 2))
    await expectAssertionFailed(async () => update(invalidAttestTokenHandler, 0, 1))
  }, 20000)

  it('should transfer remote token', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const fixture = newRemoteTokenPoolTestFixture(
      remoteChainId,
      remoteTokenBridgeId,
      remoteTokenId,
      symbol,
      name,
      decimals,
      0
    )
    const fromAddress = randomAssetAddress()
    const toAddress = randomByte32Hex()
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const nonceHex = nonce()
    const inputAsset = alphAndTokenInputAsset(fromAddress, oneAlph, fixture.remoteTokenPool.contractId, transferAmount)

    async function transferToken(consistencyLevel: bigint) {
      return TokenBridge.tests.transferToken({
        address: fixture.tokenBridge.address,
        initialFields: fixture.tokenBridge.selfState.fields,
        testArgs: {
          fromAddress: fromAddress,
          bridgeTokenId: remoteTokenId,
          tokenChainId: BigInt(remoteChainId),
          toChainId: BigInt(remoteChainId),
          toAddress: toAddress,
          tokenAmount: transferAmount,
          messageFee: defaultMessageFee,
          arbiterFee: arbiterFee,
          nonce: nonceHex,
          consistencyLevel: consistencyLevel
        },
        inputAssets: [inputAsset],
        existingContracts: fixture.remoteTokenPool.states()
      })
    }

    await expectAssertionFailed(async () => transferToken(minimalConsistencyLevel - 1n))

    const testResult = await transferToken(minimalConsistencyLevel)

    const tokenBridgeForChainState = getContractState<TokenBridgeForChainTypes.Fields>(
      testResult.contracts,
      fixture.tokenBridgeForChain.contractId
    )
    expect(tokenBridgeForChainState.fields.sendSequence).toEqual(1n)

    // check `totalBridged`
    const remoteTokenPoolState = getContractState<RemoteTokenPoolTypes.Fields>(
      testResult.contracts,
      fixture.remoteTokenPool.contractId
    )
    expect(remoteTokenPoolState.fields.totalBridged).toEqual(fixture.totalBridged - transferAmount)

    const remoteTokenPoolOutput = testResult.txOutputs[0]
    expect(remoteTokenPoolOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPool.contractId,
        amount: fixture.totalBridged + transferAmount
      }
    ])

    const governanceOutput = testResult.txOutputs[1]
    expect(BigInt(governanceOutput.alphAmount)).toEqual(minimalAlphInContract + defaultMessageFee)

    const transfer = new Transfer(transferAmount, remoteTokenId, remoteChainId, toAddress, arbiterFee)
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0] as GovernanceTypes.WormholeMessageEvent
    expect(event.name).toEqual('WormholeMessage')
    expect(event.fields).toEqual({
      sender: fixture.tokenBridge.contractId,
      targetChainId: BigInt(remoteChainId),
      sequence: 0n,
      nonce: nonceHex,
      payload: binToHex(transfer.encode()),
      consistencyLevel: minimalConsistencyLevel
    })
  })

  it('should transfer remote token failed if token wrapper id is invalid', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const fixture = newRemoteTokenPoolTestFixture(
      remoteChainId,
      remoteTokenBridgeId,
      remoteTokenId,
      symbol,
      name,
      decimals,
      0,
      randomContractAddress()
    )
    const fromAddress = randomAssetAddress()
    const toAddress = randomByte32Hex()
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const nonceHex = nonce()
    const inputAsset = alphAndTokenInputAsset(fromAddress, oneAlph, fixture.remoteTokenPool.contractId, transferAmount)
    await expectNotEnoughBalance(async () => {
      await TokenBridge.tests.transferToken({
        address: fixture.tokenBridge.address,
        initialFields: fixture.tokenBridge.selfState.fields,
        testArgs: {
          fromAddress: fromAddress,
          bridgeTokenId: remoteTokenId,
          tokenChainId: BigInt(remoteChainId),
          toChainId: BigInt(remoteChainId),
          toAddress: toAddress,
          tokenAmount: transferAmount,
          messageFee: defaultMessageFee,
          arbiterFee: arbiterFee,
          nonce: nonceHex,
          consistencyLevel: minimalConsistencyLevel
        },
        inputAssets: [inputAsset],
        existingContracts: fixture.remoteTokenPool.states()
      })
    })
  })

  it('should complete remote token transfer', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const fixture = newRemoteTokenPoolTestFixture(
      remoteChainId,
      remoteTokenBridgeId,
      remoteTokenId,
      symbol,
      name,
      decimals,
      0
    )
    const toAddress = randomAssetAddressHex()
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const transfer = new Transfer(transferAmount, remoteTokenId, remoteChainId, toAddress, arbiterFee)
    const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 0)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const testResult = await TokenBridgeForChain.tests.completeTransfer({
      address: fixture.tokenBridgeForChain.address,
      initialFields: fixture.tokenBridgeForChain.selfState.fields,
      testArgs: {
        vaa: binToHex(vaa.encode()),
        caller: payer
      },
      initialAsset: fixture.tokenBridgeForChain.selfState.asset,
      inputAssets: [defaultInputAsset],
      existingContracts: fixture.remoteTokenPool.states()
    })

    const recipientOutput = testResult.txOutputs.find((c) => c.address === hexToBase58(toAddress))!
    expect(BigInt(recipientOutput.alphAmount)).toEqual(dustAmount)
    expect(recipientOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPool.contractId,
        amount: transferAmount - arbiterFee
      }
    ])

    const callerOutputs = testResult.txOutputs.filter((c) => c.address === payer)
    checkTxCallerBalance(callerOutputs, dustAmount, [
      {
        id: fixture.remoteTokenPool.contractId,
        amount: arbiterFee
      }
    ])

    // check `totalBridged`
    const remoteTokenPoolState = getContractState<RemoteTokenPoolTypes.Fields>(
      testResult.contracts,
      fixture.remoteTokenPool.contractId
    )
    expect(remoteTokenPoolState.fields.totalBridged).toEqual(fixture.totalBridged + transferAmount)

    const tokenBridgeForChainState = getContractState<TokenBridgeForChainTypes.Fields>(
      testResult.contracts,
      fixture.tokenBridgeForChain.contractId
    )
    expect(tokenBridgeForChainState.fields.firstNext256).toEqual(1n)

    const contractOutput = testResult.txOutputs.find((c) => c.address === fixture.remoteTokenPool.address)!
    expect(contractOutput.alphAmount).toEqual(fixture.remoteTokenPool.selfState.asset.alphAmount)
    expect(contractOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPool.contractId,
        amount: fixture.totalBridged - transferAmount
      }
    ])
  })

  it('should complete transfer through bridge reward router', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const remoteTokenPoolFixture = newRemoteTokenPoolTestFixture(
      remoteChainId,
      remoteTokenBridgeId,
      remoteTokenId,
      symbol,
      name,
      decimals,
      0
    )
    const toAddress = randomAssetAddressHex()
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const transfer = new Transfer(transferAmount, remoteTokenId, remoteChainId, toAddress, arbiterFee)
    const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 0)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)

    async function test(fixture: ContractFixture<any>) {
      const testResult = await BridgeRewardRouter.tests.completeTransfer({
        initialFields: fixture.selfState.fields,
        address: fixture.address,
        initialAsset: fixture.selfState.asset,
        testArgs: {
          tokenBridgeForChain: remoteTokenPoolFixture.tokenBridgeForChain.contractId,
          vaa: binToHex(vaa.encode()),
          caller: payer
        },
        inputAssets: [defaultInputAsset],
        existingContracts: remoteTokenPoolFixture.remoteTokenPool.states()
      })

      const callerOutputs = testResult.txOutputs.filter((c) => c.address === payer)
      checkTxCallerBalance(callerOutputs, dustAmount, [
        {
          id: remoteTokenPoolFixture.remoteTokenPool.contractId,
          amount: arbiterFee
        }
      ])

      // check `totalBridged`
      const remoteTokenPoolState = getContractState<RemoteTokenPoolTypes.Fields>(
        testResult.contracts,
        remoteTokenPoolFixture.remoteTokenPool.contractId
      )
      expect(remoteTokenPoolState.fields.totalBridged).toEqual(remoteTokenPoolFixture.totalBridged + transferAmount)

      const tokenBridgeForChainState = getContractState<TokenBridgeForChainTypes.Fields>(
        testResult.contracts,
        remoteTokenPoolFixture.tokenBridgeForChain.contractId
      )
      expect(tokenBridgeForChainState.fields.firstNext256).toEqual(1n)

      const remoteTokenPoolOutput = testResult.txOutputs.find(
        (c) => c.address === remoteTokenPoolFixture.remoteTokenPool.address
      )!
      expect(remoteTokenPoolOutput.alphAmount).toEqual(
        remoteTokenPoolFixture.remoteTokenPool.selfState.asset.alphAmount
      )
      expect(remoteTokenPoolOutput.tokens).toEqual([
        {
          id: remoteTokenPoolFixture.remoteTokenPool.contractId,
          amount: remoteTokenPoolFixture.totalBridged - transferAmount
        }
      ])
      return testResult
    }

    const fixture0 = createBridgeRewardRouter(ONE_ALPH * 3n)
    const testResult0 = await test(fixture0)

    const recipientOutputs0 = testResult0.txOutputs.filter((c) => c.address === hexToBase58(toAddress))
    expect(recipientOutputs0.length).toEqual(2)
    expect(recipientOutputs0[0].alphAmount).toEqual(dustAmount)
    expect(recipientOutputs0[0].tokens).toEqual([
      { id: remoteTokenPoolFixture.remoteTokenPool.contractId, amount: transferAmount - arbiterFee }
    ])
    expect(recipientOutputs0[1].alphAmount).toEqual(ONE_ALPH)

    const bridgeRewardRouterState0 = testResult0.contracts.find((c) => c.address === fixture0.address)!
    expect(bridgeRewardRouterState0.asset.alphAmount).toEqual(ONE_ALPH * 2n)

    const fixture1 = createBridgeRewardRouter(ONE_ALPH)
    const testResult1 = await test(fixture1)

    const recipientOutputs1 = testResult1.txOutputs.filter((c) => c.address === hexToBase58(toAddress))
    expect(recipientOutputs1.length).toEqual(1)
    expect(recipientOutputs1[0].alphAmount).toEqual(dustAmount)
    expect(recipientOutputs1[0].tokens).toEqual([
      { id: remoteTokenPoolFixture.remoteTokenPool.contractId, amount: transferAmount - arbiterFee }
    ])

    const bridgeRewardRouterState1 = testResult1.contracts.find((c) => c.address === fixture1.address)!
    expect(bridgeRewardRouterState1.asset.alphAmount).toEqual(ONE_ALPH)
  })

  it('should not reward if the token is from alephium', async () => {
    await buildProject()
    const testToken = createTestToken()
    const localTokenPoolFixture = newLocalTokenPoolTestFixture(remoteChainId, remoteTokenBridgeId, testToken.contractId)
    const toAddressHex = randomAssetAddressHex()
    const toAddress = hexToBase58(toAddressHex)
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const transfer = new Transfer(transferAmount, testToken.contractId, CHAIN_ID_ALEPHIUM, toAddressHex, arbiterFee)
    const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 0)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)

    const fixture = createBridgeRewardRouter(alph(3))
    const testResult = await BridgeRewardRouter.tests.completeTransfer({
      address: fixture.address,
      initialFields: fixture.selfState.fields,
      testArgs: {
        tokenBridgeForChain: localTokenPoolFixture.tokenBridgeForChain.contractId,
        vaa: binToHex(vaa.encode()),
        caller: payer
      },
      initialAsset: fixture.selfState.asset,
      inputAssets: [defaultInputAsset],
      existingContracts: localTokenPoolFixture.localTokenPool.states().concat(testToken.states())
    })

    const recipientOutputs = testResult.txOutputs.filter((o) => o.address === toAddress)
    expect(recipientOutputs.length).toEqual(1)
    expect(recipientOutputs[0].alphAmount).toEqual(dustAmount)

    const rewardRouterState = getContractState(testResult.contracts, fixture.address)
    expect(rewardRouterState.asset.alphAmount).toEqual(alph(3))
  })

  it('should failed to complete transfer and create unexecuted sequence contracts', async () => {
    await buildProject()
    const testTokenInfo = createTestToken()
    const fixture = newLocalTokenPoolTestFixture(remoteChainId, remoteTokenBridgeId, testTokenInfo.contractId)
    const toAddress = randomAssetAddressHex()
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const transfer = new Transfer(transferAmount, testTokenInfo.contractId, CHAIN_ID_ALEPHIUM, toAddress, arbiterFee)
    const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 768)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const testResult = await TokenBridgeForChain.tests.completeTransfer({
      address: fixture.tokenBridgeForChain.address,
      initialFields: fixture.tokenBridgeForChain.selfState.fields,
      testArgs: {
        vaa: binToHex(vaa.encode()),
        caller: payer
      },
      initialAsset: fixture.tokenBridgeForChain.selfState.asset,
      inputAssets: [defaultInputAsset],
      existingContracts: fixture.localTokenPool.states().concat(testTokenInfo.states())
    })

    const tokenBridgeForChainState = getContractState<TokenBridgeForChainTypes.Fields>(
      testResult.contracts,
      fixture.tokenBridgeForChain.contractId
    )
    expect(tokenBridgeForChainState.fields.start).toEqual(256n)
    expect(tokenBridgeForChainState.fields.firstNext256).toEqual(0n)
    expect(tokenBridgeForChainState.fields.secondNext256).toEqual(0n)

    // the locked assets have not changed
    const tokenPoolState = getContractState<LocalTokenPoolTypes.Fields>(
      testResult.contracts,
      fixture.localTokenPool.contractId
    )
    const tokenPoolInitAsset = fixture.localTokenPool.selfState.asset
    expect(tokenPoolState.asset.alphAmount).toEqual(tokenPoolInitAsset.alphAmount)
    expect(tokenPoolState.asset.tokens).toEqual(tokenPoolInitAsset.tokens)

    const unexecutedSequenceContractId = subContractId(fixture.tokenBridgeForChain.contractId, '0000000000000000', 0)
    const unexecutedSequenceState = getContractState<UnexecutedSequenceTypes.Fields>(
      testResult.contracts,
      unexecutedSequenceContractId
    )
    expect(unexecutedSequenceState.fields.begin).toEqual(0n)
    expect(unexecutedSequenceState.fields.sequences).toEqual(0n)

    checkTxCallerBalance(
      testResult.txOutputs.filter((c) => c.address === payer),
      0n
    )
  })

  it('should allow transfer wrapped token to non-original chain', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const chainB = CHAIN_ID_ALEPHIUM + 1 // token chain id
    const chainC = CHAIN_ID_ALEPHIUM + 2 // to chain id
    const fixture = newRemoteTokenPoolTestFixture(chainB, remoteTokenBridgeId, remoteTokenId, symbol, name, decimals, 0)
    const chainCTokenBridgeId = randomByte32Hex()
    const tokenBridgeForChainC = createTokenBridgeForChain(fixture.tokenBridge, chainC, chainCTokenBridgeId)
    const fromAddress = randomAssetAddress()
    const toAddress = randomByte32Hex()
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const nonceHex = nonce()
    const inputAsset = alphAndTokenInputAsset(fromAddress, oneAlph, fixture.remoteTokenPool.contractId, transferAmount)

    async function transferToken(consistencyLevel: bigint) {
      return TokenBridge.tests.transferToken({
        address: fixture.tokenBridge.address,
        initialFields: fixture.tokenBridge.selfState.fields,
        testArgs: {
          fromAddress: fromAddress,
          bridgeTokenId: remoteTokenId,
          tokenChainId: BigInt(chainB),
          toChainId: BigInt(chainC),
          toAddress: toAddress,
          tokenAmount: transferAmount,
          messageFee: defaultMessageFee,
          arbiterFee: arbiterFee,
          nonce: nonceHex,
          consistencyLevel: consistencyLevel
        },
        inputAssets: [inputAsset],
        existingContracts: fixture.remoteTokenPool.states().concat(tokenBridgeForChainC.states())
      })
    }

    const testResult = await transferToken(minimalConsistencyLevel)

    const tokenBridgeForChainBState = getContractState<TokenBridgeForChainTypes.Fields>(
      testResult.contracts,
      fixture.tokenBridgeForChain.contractId
    )
    expect(tokenBridgeForChainBState.fields.sendSequence).toEqual(0n)

    const tokenBridgeForChainCState = getContractState<TokenBridgeForChainTypes.Fields>(
      testResult.contracts,
      tokenBridgeForChainC.contractId
    )
    expect(tokenBridgeForChainCState.fields.sendSequence).toEqual(1n)

    // check `totalBridged`
    const remoteTokenPoolState = getContractState<RemoteTokenPoolTypes.Fields>(
      testResult.contracts,
      fixture.remoteTokenPool.contractId
    )
    expect(remoteTokenPoolState.fields.totalBridged).toEqual(fixture.totalBridged - transferAmount)

    const remoteTokenPoolOutput = testResult.txOutputs[0]
    expect(remoteTokenPoolOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPool.contractId,
        amount: fixture.totalBridged + transferAmount
      }
    ])

    const governanceOutput = testResult.txOutputs[1]
    expect(BigInt(governanceOutput.alphAmount)).toEqual(minimalAlphInContract + defaultMessageFee)

    const transfer = new Transfer(transferAmount, remoteTokenId, chainB, toAddress, arbiterFee)
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0] as GovernanceTypes.WormholeMessageEvent
    expect(event.name).toEqual('WormholeMessage')
    expect(event.fields).toEqual({
      sender: fixture.tokenBridge.contractId,
      targetChainId: BigInt(chainC),
      sequence: 0n,
      nonce: nonceHex,
      payload: binToHex(transfer.encode()),
      consistencyLevel: minimalConsistencyLevel
    })
  })

  it('should complete transfer for wrapped asset', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const chainB = CHAIN_ID_ALEPHIUM + 1 // token chain id
    const chainC = CHAIN_ID_ALEPHIUM + 2 // emitter chain id
    const fixture = newRemoteTokenPoolTestFixture(chainB, remoteTokenBridgeId, remoteTokenId, symbol, name, decimals, 0)
    const chainCTokenBridgeId = randomByte32Hex()
    const tokenBridgeForChainC = createTokenBridgeForChain(fixture.tokenBridge, chainC, chainCTokenBridgeId)
    const toAddress = randomAssetAddressHex()
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const transfer = new Transfer(transferAmount, remoteTokenId, chainB, toAddress, arbiterFee)
    const vaaBody = new VAABody(transfer.encode(), chainC, CHAIN_ID_ALEPHIUM, chainCTokenBridgeId, 0)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const testResult = await TokenBridgeForChain.tests.completeTransfer({
      address: tokenBridgeForChainC.address,
      initialFields: tokenBridgeForChainC.selfState.fields,
      testArgs: { vaa: binToHex(vaa.encode()), caller: payer },
      initialAsset: tokenBridgeForChainC.selfState.asset,
      inputAssets: [defaultInputAsset],
      existingContracts: fixture.remoteTokenPool.states().concat(tokenBridgeForChainC.states())
    })

    const recipientOutput = testResult.txOutputs.find((c) => c.address === hexToBase58(toAddress))!
    expect(BigInt(recipientOutput.alphAmount)).toEqual(dustAmount)
    expect(recipientOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPool.contractId,
        amount: transferAmount - arbiterFee
      }
    ])

    const callerOutputs = testResult.txOutputs.filter((c) => c.address === payer)
    checkTxCallerBalance(callerOutputs, dustAmount, [
      {
        id: fixture.remoteTokenPool.contractId,
        amount: arbiterFee
      }
    ])

    // check `totalBridged`
    const remoteTokenPoolState = getContractState<RemoteTokenPoolTypes.Fields>(
      testResult.contracts,
      fixture.remoteTokenPool.contractId
    )
    expect(remoteTokenPoolState.fields.totalBridged).toEqual(fixture.totalBridged + transferAmount)

    // check `TokenBridgeForChain` sequences
    const tokenBridgeForChainBState = getContractState<TokenBridgeForChainTypes.Fields>(
      testResult.contracts,
      fixture.tokenBridgeForChain.contractId
    )
    expect(tokenBridgeForChainBState.fields.firstNext256).toEqual(0n)

    const tokenBridgeForChainCState = getContractState<TokenBridgeForChainTypes.Fields>(
      testResult.contracts,
      tokenBridgeForChainC.contractId
    )
    expect(tokenBridgeForChainCState.fields.firstNext256).toEqual(1n)

    const contractOutput = testResult.txOutputs.find((c) => c.address === fixture.remoteTokenPool.address)!
    expect(contractOutput.alphAmount).toEqual(oneAlph)
    expect(contractOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPool.contractId,
        amount: fixture.totalBridged - transferAmount
      }
    ])
  })

  it('should destroy unexecuted sequence contracts', async () => {
    await buildProject()
    const fixture = newTokenBridgeForChainTestFixture(remoteChainId, remoteTokenBridgeId)
    const paths = [0, 1, 2, 5, 8]
    const subContracts: ContractState[] = []
    for (const path of paths) {
      const unexecutedSequenceContractId = subContractId(
        fixture.tokenBridgeForChain.contractId,
        zeroPad(path.toString(16), 8),
        0
      )
      const contractInfo = createUnexecutedSequence(
        fixture.tokenBridgeForChain.contractId,
        BigInt(path * 256),
        0n,
        unexecutedSequenceContractId
      )
      subContracts.push(contractInfo.selfState)
    }
    const existingContracts = Array.prototype.concat(fixture.tokenBridgeForChain.states(), subContracts)
    const destroyUnexecutedSequenceContracts = new DestroyUnexecutedSequenceContracts(remoteChainId, paths)
    const vaaBody = new VAABody(
      destroyUnexecutedSequenceContracts.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const testResult = await TokenBridge.tests.destroyUnexecutedSequenceContracts({
      address: fixture.tokenBridge.address,
      initialFields: fixture.tokenBridge.selfState.fields,
      testArgs: { vaa: binToHex(vaa.encode()) },
      inputAssets: [defaultInputAsset],
      existingContracts: existingContracts
    })

    expect(testResult.events.length).toEqual(paths.length)
    testResult.events.forEach((e, index) => {
      const event = e as ContractDestroyedEvent
      expect(event.name).toEqual('ContractDestroyed')
      expect(event.fields.address).toEqual(subContracts[index].address)
    })
    const refundAlphAmount = BigInt(paths.length) * oneAlph
    const expectedAlphAmount = BigInt(fixture.tokenBridgeForChain.selfState.asset.alphAmount) + refundAlphAmount
    expect(testResult.txOutputs[0].address).toEqual(fixture.tokenBridgeForChain.address)
    expect(testResult.txOutputs[0].alphAmount).toEqual(expectedAlphAmount)
  })

  it('should test upgrade contract', async () => {
    await buildProject()
    const tokenBridge = createTokenBridge()

    async function upgrade(contractUpgrade: ContractUpgrade): Promise<TestContractResult<null>> {
      const vaaBody = new VAABody(
        contractUpgrade.encode(tokenBridgeModule, 2),
        governanceChainId,
        CHAIN_ID_ALEPHIUM,
        governanceEmitterAddress,
        0
      )
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      return TokenBridge.tests.upgradeContract({
        address: tokenBridge.address,
        initialFields: tokenBridge.selfState.fields,
        testArgs: { vaa: binToHex(vaa.encode()) },
        initialAsset: { alphAmount: oneAlph },
        existingContracts: tokenBridge.dependencies
      })
    }

    {
      const newContractCode = TokenBridgeV1.contract.bytecode
      const contractUpgrade = new ContractUpgrade(newContractCode)
      const testResult = await upgrade(contractUpgrade)
      const newContract = testResult.contracts[testResult.contracts.length - 1]
      expect(newContract.address).toEqual(tokenBridge.address)
      expect(newContract.bytecode).toEqual(newContractCode)
    }

    {
      await expectAssertionFailed(async () => {
        const newContractCode = Empty.contract.bytecode
        const prevStateHash = randomBytes(32).toString('hex')
        const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, '010200', '010201')
        await upgrade(contractUpgrade)
      })
    }

    {
      const newContractCode = Empty.contract.bytecode
      const receivedSequence = tokenBridge.selfState.fields.receivedSequence
      const sendSequence = tokenBridge.selfState.fields.sendSequence
      const consistency = Number(tokenBridge.selfState.fields.minimalConsistencyLevel)
      const refundAddress = tokenBridge.selfState.fields.refundAddress
      const prevEncodedState = Buffer.concat([
        encodeU256(BigInt(receivedSequence) + 1n),
        encodeU256(sendSequence),
        encodeUint8(consistency),
        base58.decode(refundAddress)
      ])
      const prevStateHash = Buffer.from(blake.blake2b(prevEncodedState, undefined, 32)).toString('hex')
      const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, '010200', '010201')
      const testResult = await upgrade(contractUpgrade)
      const newContract = testResult.contracts[testResult.contracts.length - 1]
      expect(newContract.address).toEqual(tokenBridge.address)
      expect(newContract.bytecode).toEqual(newContractCode)
      expect(newContract.fields).toEqual({ a: 0n, b: 1n })
    }
  }, 10000)

  it('should check token bridge public functions', async () => {
    await buildProject()
    const tokenBridge = Project.contract('TokenBridge')
    expect(tokenBridge.publicFunctions()).toEqual([
      'createLocalAttestTokenHandler',
      'registerChain',
      'upgradeContract',
      'destroyUnexecutedSequenceContracts',
      'updateMinimalConsistencyLevel',
      'getRefundAddress',
      'updateRefundAddress',
      'getMessageFee',
      'attestToken',
      'createLocalTokenPool',
      'createRemoteTokenPool',
      'updateRemoteTokenPool',
      'transferToken'
    ])
  })

  it('should update refund address', async () => {
    await buildProject()
    const fixture = createTokenBridge()

    async function updateRefundAddress(targetChainId: number, newRefundAddressHex: string) {
      const newRefundAddress = base58.encode(Buffer.from(newRefundAddressHex, 'hex'))
      expect(fixture.selfState.fields.refundAddress).not.toEqual(newRefundAddress)
      const updateRefundAddress = new UpdateRefundAddress(newRefundAddressHex)
      const vaaBody = new VAABody(
        updateRefundAddress.encode(),
        governanceChainId,
        targetChainId,
        governanceEmitterAddress,
        0
      )
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      const result = await TokenBridge.tests.updateRefundAddress({
        address: fixture.address,
        initialFields: fixture.selfState.fields,
        testArgs: { vaa: binToHex(vaa.encode()) },
        initialAsset: { alphAmount: oneAlph },
        existingContracts: fixture.dependencies
      })
      const tokenBridgeState = getContractState<TokenBridgeTypes.Fields>(result.contracts, fixture.contractId)
      expect(tokenBridgeState.fields.refundAddress).toEqual(newRefundAddress)
    }

    const p2pkhAddressHex = randomP2PKHAddressHex()
    await updateRefundAddress(CHAIN_ID_ALEPHIUM, p2pkhAddressHex)
    await expectAssertionFailed(async () => updateRefundAddress(CHAIN_ID_ALEPHIUM + 1, p2pkhAddressHex)) // invalid chain id

    await updateRefundAddress(CHAIN_ID_ALEPHIUM, randomP2MPKHAddressHex(3, 5))
    await updateRefundAddress(CHAIN_ID_ALEPHIUM, randomP2SHAddressHex())
    await expectAssertionFailed(async () => updateRefundAddress(CHAIN_ID_ALEPHIUM, randomP2CAddressHex())) // p2c address
  }, 10000)

  it('should test deposit/withdraw', async () => {
    await buildProject()
    const fixture = newTokenBridgeForChainTestFixture(remoteChainId, randomByte32Hex())
    const testResult0 = await TokenBridgeForChain.tests.deposit({
      initialFields: fixture.tokenBridgeForChain.selfState.fields,
      initialAsset: { alphAmount: oneAlph },
      address: fixture.tokenBridgeForChain.address,
      testArgs: {
        from: payer,
        alphAmount: alph(3)
      },
      inputAssets: [{ address: payer, asset: { alphAmount: alph(4) } }],
      existingContracts: fixture.tokenBridgeForChain.dependencies
    })
    const contractState0 = testResult0.contracts.find((c) => c.address === fixture.tokenBridgeForChain.address)!
    expect(contractState0.asset).toEqual({ alphAmount: alph(4), tokens: [] })
    const payerOutput = testResult0.txOutputs.find((c) => c.address === payer)!
    expect(payerOutput.alphAmount).toEqual(oneAlph - defaultGasFee)

    const refundAddress = fixture.tokenBridge.selfState.fields.refundAddress
    const testResult1 = await TokenBridgeForChain.tests.withdraw({
      initialFields: fixture.tokenBridgeForChain.selfState.fields,
      initialAsset: { alphAmount: alph(4) },
      address: fixture.tokenBridgeForChain.address,
      testArgs: { alphAmount: alph(3) },
      inputAssets: [{ address: refundAddress, asset: { alphAmount: oneAlph } }],
      existingContracts: fixture.tokenBridgeForChain.dependencies
    })
    const contractState1 = getContractState<TokenBridgeForChainTypes.Fields>(
      testResult1.contracts,
      fixture.tokenBridgeForChain.contractId
    )
    expect(contractState1.asset).toEqual({ alphAmount: oneAlph, tokens: [] })
    const refundAddressOutput = testResult1.txOutputs.find((c) => c.address === refundAddress)!
    expect(refundAddressOutput.alphAmount).toEqual(alph(4) - defaultGasFee)
  })

  it('should test add rewards', async () => {
    await buildProject()
    const fixture = createBridgeRewardRouter(ONE_ALPH)
    const testResult = await BridgeRewardRouter.tests.addRewards({
      initialFields: fixture.selfState.fields,
      address: fixture.address,
      initialAsset: fixture.selfState.asset,
      testArgs: { caller: payer, amount: ONE_ALPH },
      inputAssets: [defaultInputAsset]
    })
    const contractState = testResult.contracts.find((c) => c.address === fixture.address)!
    expect(contractState.asset.alphAmount).toEqual(ONE_ALPH * 2n)

    const callerOutputs = testResult.txOutputs.filter((c) => c.address === payer)
    checkTxCallerBalance(callerOutputs, ONE_ALPH, [])
  })
})

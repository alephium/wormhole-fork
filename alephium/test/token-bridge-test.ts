import {
  Asset,
  InputAsset,
  Output,
  TestContractResult,
  Token,
  ContractState,
  contractIdFromAddress,
  binToHex,
  Project,
  web3,
  subContractId,
  ALPH_TOKEN_ID
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
  createTestToken,
  createTokenBridge,
  createTokenBridgeForChain,
  DestroyUnexecutedSequenceContracts,
  minimalConsistencyLevel,
  newLocalTokenPoolFixture,
  newRemoteTokenPoolFixture,
  newTokenBridgeFixture,
  newTokenBridgeForChainFixture,
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
  ContractInfo
} from './fixtures/wormhole-fixture'
import { randomBytes } from 'crypto'
import * as blake from 'blakejs'
import { createUnexecutedSequence } from './fixtures/sequence-fixture'
import * as base58 from 'bs58'

describe('test token bridge', () => {
  web3.setCurrentNodeProvider('http://127.0.0.1:22973')

  const payer = randomAssetAddress()
  const defaultInputAsset: InputAsset = alphInputAsset(payer, alph(4))

  function checkTxCallerBalance(output: Output, spent: bigint, tokens: Token[] = []) {
    const remain = (defaultInputAsset.asset.alphAmount as bigint) - defaultGasFee - spent
    expect(output.address).toEqual(payer)
    expect(BigInt(output.alphAmount)).toEqual(remain)
    expect(output.tokens).toEqual(tokens)
  }

  function alphAndTokenAsset(alphAmount: bigint, tokenId: string, tokenAmount: bigint): Asset {
    return {
      alphAmount: alphAmount,
      tokens: [
        {
          id: tokenId,
          amount: tokenAmount
        }
      ]
    }
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
    return {
      address: fromAddress,
      asset: { alphAmount: alphAmount }
    }
  }

  const decimals = 8
  const symbol = randomByte32Hex()
  const name = randomByte32Hex()
  const remoteChainId = CHAIN_ID_ALEPHIUM + 1
  const remoteTokenBridgeId = randomByte32Hex()

  it('should attest token', async () => {
    await buildProject()
    const tokenBridgeInfo = createTokenBridge()
    const tokenBridge = tokenBridgeInfo.contract
    const testToken = createTestToken()
    const nonceHex = nonce()
    const inputAsset = alphAndTokenInputAsset(payer, alph(2), testToken.contractId, 1n)
    const testResult = await tokenBridge.testPublicMethod('attestToken', {
      address: tokenBridgeInfo.address,
      initialFields: tokenBridgeInfo.selfState.fields,
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
      existingContracts: tokenBridgeInfo.dependencies.concat(testToken.states())
    })
    const governanceOutput = testResult.txOutputs[0]
    expect(governanceOutput.address).toEqual(tokenBridgeInfo.governance.address)
    expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + defaultMessageFee))

    const message = new AttestToken(testToken.contractId, CHAIN_ID_ALEPHIUM, symbol, name, decimals)
    const events = testResult.events
    expect(events.length).toEqual(1)
    expect(events[0].name).toEqual('WormholeMessage')
    expect(events[0].fields).toEqual({
      sender: tokenBridgeInfo.contractId,
      targetChainId: 0n,
      sequence: 0n,
      nonce: nonceHex,
      payload: binToHex(message.encode()),
      consistencyLevel: 0n
    })
  })

  it('should attest alph', async () => {
    await buildProject()
    const tokenBridgeInfo = createTokenBridge()
    const tokenBridge = tokenBridgeInfo.contract
    const nonceHex = nonce()
    const inputAsset = alphInputAsset(payer, alph(2))
    const testResult = await tokenBridge.testPublicMethod('attestToken', {
      address: tokenBridgeInfo.address,
      initialFields: tokenBridgeInfo.selfState.fields,
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
      existingContracts: tokenBridgeInfo.dependencies
    })
    const governanceOutput = testResult.txOutputs[0]
    expect(governanceOutput.address).toEqual(tokenBridgeInfo.governance.address)
    expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + defaultMessageFee))

    const message = new AttestToken(ALPH_TOKEN_ID, CHAIN_ID_ALEPHIUM, symbol, name, decimals)
    const events = testResult.events
    expect(events.length).toEqual(1)
    expect(events[0].name).toEqual('WormholeMessage')
    expect(events[0].fields).toEqual({
      sender: tokenBridgeInfo.contractId,
      targetChainId: 0n,
      sequence: 0n,
      nonce: nonceHex,
      payload: binToHex(message.encode()),
      consistencyLevel: 0n
    })
  })

  it('should update minimal consistency level', async () => {
    await buildProject()
    const tokenBridgeInfo = createTokenBridge()
    const tokenBridge = tokenBridgeInfo.contract
    const newMinimalConsistencyLevel = 5
    const message = new UpdateMinimalConsistencyLevel(newMinimalConsistencyLevel)
    const vaaBody = new VAABody(message.encode(), governanceChainId, CHAIN_ID_ALEPHIUM, governanceEmitterAddress, 0)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const testResult = await tokenBridge.testPublicMethod('updateMinimalConsistencyLevel', {
      address: tokenBridgeInfo.address,
      initialFields: tokenBridgeInfo.selfState.fields,
      testArgs: {
        vaa: binToHex(vaa.encode())
      },
      inputAssets: [defaultInputAsset],
      existingContracts: tokenBridgeInfo.dependencies
    })

    const tokenBridgeState = testResult.contracts.find((c) => c.contractId === tokenBridgeInfo.contractId)!
    expect(tokenBridgeState.fields['minimalConsistencyLevel']).toEqual(BigInt(newMinimalConsistencyLevel))
  })

  it('should register chain', async () => {
    await buildProject()
    const tokenBridgeInfo = createTokenBridge()
    const tokenBridge = tokenBridgeInfo.contract
    const registerChain = new RegisterChain(remoteChainId, remoteTokenBridgeId)
    const vaaBody = new VAABody(
      registerChain.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const testResult = await tokenBridge.testPublicMethod('registerChain', {
      address: tokenBridgeInfo.address,
      initialFields: tokenBridgeInfo.selfState.fields,
      testArgs: {
        vaa: binToHex(vaa.encode()),
        payer: payer,
        createContractAlphAmount: minimalAlphInContract
      },
      inputAssets: [defaultInputAsset],
      existingContracts: tokenBridgeInfo.dependencies
    })

    const output0 = testResult.txOutputs[0]
    expect(output0.address).toEqual(attestTokenHandlerAddress(tokenBridgeInfo.contractId, remoteChainId))
    expect(output0.alphAmount).toEqual(minimalAlphInContract)
    const output1 = testResult.txOutputs[1]
    expect(output1.address).toEqual(tokenBridgeForChainAddress(tokenBridgeInfo.contractId, remoteChainId))
    expect(output1.alphAmount).toEqual(minimalAlphInContract)
  })

  it('should register chain failed if sequence is invalid', async () => {
    await buildProject()
    const tokenBridgeInfo = createTokenBridge(undefined, 3n)
    const tokenBridge = tokenBridgeInfo.contract
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
      return tokenBridge.testPublicMethod('registerChain', {
        address: tokenBridgeInfo.address,
        initialFields: tokenBridgeInfo.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          payer: payer,
          createContractAlphAmount: minimalAlphInContract
        },
        inputAssets: [defaultInputAsset],
        existingContracts: tokenBridgeInfo.dependencies
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
    const fixture = newTokenBridgeFixture()
    const localTokenBridgeId = fixture.tokenBridgeInfo.contractId

    async function testCreateAlphTokenPool(attestTokenHandlerInfo: ContractInfo, targetChainId: number) {
      const attestToken = new AttestToken(ALPH_TOKEN_ID, CHAIN_ID_ALEPHIUM, symbol, name, decimals)
      const vaaBody = new VAABody(attestToken.encode(), CHAIN_ID_ALEPHIUM, targetChainId, localTokenBridgeId, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      const inputAsset = alphInputAsset(payer, alph(3))
      const testResult = await attestTokenHandlerInfo.contract.testPublicMethod('createLocalTokenPool', {
        address: attestTokenHandlerInfo.address,
        initialFields: attestTokenHandlerInfo.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          payer: payer,
          createContractAlphAmount: minimalAlphInContract,
          tokenAmount: 1n
        },
        inputAssets: [inputAsset],
        existingContracts: fixture.tokenBridgeInfo.states()
      })

      const localTokenPoolAddress = tokenPoolAddress(localTokenBridgeId, CHAIN_ID_ALEPHIUM, ALPH_TOKEN_ID)
      const localTokenPoolState = testResult.contracts.find((c) => c.address === localTokenPoolAddress)!
      expect(localTokenPoolState.fields["decimals_"]).toEqual(BigInt(decimals))

      const localTokenPoolOutput = testResult.txOutputs.find((o) => o.address === localTokenPoolAddress)!
      expect(localTokenPoolOutput.alphAmount).toEqual(minimalAlphInContract)
      expect(localTokenPoolOutput.tokens).toEqual([])
    }

    const attestTokenHandlerInfo = createAttestTokenHandler(fixture.tokenBridgeInfo, CHAIN_ID_ALEPHIUM, localTokenBridgeId)
    await testCreateAlphTokenPool(attestTokenHandlerInfo, 0)
    await expectAssertionFailed(async () => testCreateAlphTokenPool(attestTokenHandlerInfo, CHAIN_ID_ALEPHIUM))

    const invalidAttestTokenHandlerInfo = createAttestTokenHandler(fixture.tokenBridgeInfo, remoteChainId, remoteTokenBridgeId)
    await expectAssertionFailed(async () => testCreateAlphTokenPool(invalidAttestTokenHandlerInfo, 0))
    await expectAssertionFailed(async () => testCreateAlphTokenPool(invalidAttestTokenHandlerInfo, CHAIN_ID_ALEPHIUM))
  })

  it('should transfer alph to remote chain', async () => {
    await buildProject()
    const fromAddress = randomAssetAddress()
    const toAddress = randomByte32Hex()
    const transferAmount = oneAlph
    const nonceHex = nonce()
    const inputAsset = alphInputAsset(fromAddress, transferAmount * 2n)

    async function test(messageFee: bigint, arbiterFee: bigint) {
      const fixture = newLocalTokenPoolFixture(remoteChainId, remoteTokenBridgeId, ALPH_TOKEN_ID, messageFee)
      const tokenBridge = fixture.tokenBridgeInfo.contract
      const testResult = await tokenBridge.testPublicMethod('transferToken', {
        address: fixture.tokenBridgeInfo.address,
        initialFields: fixture.tokenBridgeInfo.selfState.fields,
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
        existingContracts: fixture.localTokenPoolInfo.states()
      })

      const tokenBridgeForChainState = testResult.contracts.find(
        (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
      )!
      expect(tokenBridgeForChainState.fields['sendSequence']).toEqual(1n)

      // check `totalBridged`
      const tokenPoolState = testResult.contracts.find((c) => c.contractId === fixture.localTokenPoolInfo.contractId)!
      expect(tokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged + transferAmount)
      expect(tokenPoolState.asset.alphAmount).toEqual(fixture.totalBridged + transferAmount + minimalAlphInContract)

      const tokenPoolOutput = testResult.txOutputs.find((c) => c.address === fixture.localTokenPoolInfo.address)!
      expect(tokenPoolOutput.alphAmount).toEqual(fixture.totalBridged + transferAmount + minimalAlphInContract)
      expect(tokenPoolOutput.tokens).toEqual([])

      if (messageFee !== 0n) {
        const governanceOutput = testResult.txOutputs.find(
          (c) => c.address === fixture.tokenBridgeInfo.governance.address
        )!
        expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + messageFee))
      }

      const transferMessage = new Transfer(transferAmount, ALPH_TOKEN_ID, CHAIN_ID_ALEPHIUM, toAddress, arbiterFee)
      expect(testResult.events.length).toEqual(1)
      const event = testResult.events[0]
      expect(event.name).toEqual('WormholeMessage')
      expect(event.fields).toEqual({
        sender: fixture.tokenBridgeInfo.contractId,
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
    const fixture = newLocalTokenPoolFixture(remoteChainId, remoteTokenBridgeId, ALPH_TOKEN_ID)
    const toAddress = randomAssetAddressHex()
    const transferAmount = oneAlph
    const tokenBridgeForChain = fixture.tokenBridgeForChainInfo.contract

    async function test(arbiterFee: bigint) {
      const transfer = new Transfer(transferAmount, ALPH_TOKEN_ID, CHAIN_ID_ALEPHIUM, toAddress, arbiterFee)
      const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)

      const testResult = await tokenBridgeForChain.testPublicMethod('completeTransfer', {
        address: fixture.tokenBridgeForChainInfo.address,
        initialFields: fixture.tokenBridgeForChainInfo.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          caller: defaultInputAsset.address
        },
        initialAsset: fixture.tokenBridgeForChainInfo.selfState.asset,
        inputAssets: [defaultInputAsset],
        existingContracts: fixture.localTokenPoolInfo.states()
      })

      // check `totalBridged`
      const tokenPoolState = testResult.contracts.find((c) => c.contractId === fixture.localTokenPoolInfo.contractId)!
      expect(tokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged - transferAmount)
      expect(tokenPoolState.asset.alphAmount).toEqual(fixture.totalBridged - transferAmount + minimalAlphInContract)

      const tokenBridgeForChainState = testResult.contracts.find(
        (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
      )!
      expect(tokenBridgeForChainState.fields['firstNext256']).toEqual(1n)

      const recipientOutput = testResult.txOutputs.find((c) => c.address === hexToBase58(toAddress))!
      expect(BigInt(recipientOutput.alphAmount)).toEqual(transferAmount - arbiterFee + dustAmount)

      const callerOutput = testResult.txOutputs.find((c) => c.address === defaultInputAsset.address)!
      checkTxCallerBalance(callerOutput, dustAmount - arbiterFee)

      const tokenPoolOutput = testResult.txOutputs.find((c) => c.address === fixture.localTokenPoolInfo.address)!
      expect(tokenPoolOutput.alphAmount).toEqual(fixture.totalBridged - transferAmount + minimalAlphInContract)
      expect(tokenPoolOutput.tokens).toEqual([])
    }

    await test(10n ** 12n)
    await test(0n)
  })

  it('should create local token pool', async () => {
    await buildProject()
    const fixture = newTokenBridgeFixture()
    const testToken = createTestToken()
    const localTokenBridgeId = fixture.tokenBridgeInfo.contractId

    async function testCreateLocalTokenPool(attestTokenHandlerInfo: ContractInfo, targetChainId: number) {
      const attestToken = new AttestToken(testToken.contractId, CHAIN_ID_ALEPHIUM, symbol, name, decimals)
      const vaaBody = new VAABody(attestToken.encode(), CHAIN_ID_ALEPHIUM, targetChainId, localTokenBridgeId, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      const inputAsset = alphAndTokenInputAsset(payer, alph(2), testToken.contractId, 1n)
      const testResult = await attestTokenHandlerInfo.contract.testPublicMethod('createLocalTokenPool', {
        address: attestTokenHandlerInfo.address,
        initialFields: attestTokenHandlerInfo.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          payer: payer,
          createContractAlphAmount: minimalAlphInContract,
          tokenAmount: 1n
        },
        inputAssets: [inputAsset],
        existingContracts: fixture.tokenBridgeInfo.states().concat(testToken.states())
      })

      const localTokenPoolAddress = tokenPoolAddress(localTokenBridgeId, CHAIN_ID_ALEPHIUM, testToken.contractId)
      const localTokenPoolState = testResult.contracts.find((c) => c.address === localTokenPoolAddress)!
      expect(localTokenPoolState.fields["decimals_"]).toEqual(BigInt(decimals))

      const localTokenPoolOutput = testResult.txOutputs.find((o) => o.address === localTokenPoolAddress)!
      expect(localTokenPoolOutput.alphAmount).toEqual(minimalAlphInContract)
      expect(localTokenPoolOutput.tokens).toEqual([])
    }

    const attestTokenHandlerInfo = createAttestTokenHandler(fixture.tokenBridgeInfo, CHAIN_ID_ALEPHIUM, localTokenBridgeId)
    await testCreateLocalTokenPool(attestTokenHandlerInfo, 0)
    await expectAssertionFailed(async () => testCreateLocalTokenPool(attestTokenHandlerInfo, CHAIN_ID_ALEPHIUM))

    const invalidAttestTokenHandlerInfo = createAttestTokenHandler(fixture.tokenBridgeInfo, remoteChainId, remoteTokenBridgeId)
    await expectAssertionFailed(async () => testCreateLocalTokenPool(invalidAttestTokenHandlerInfo, 0))
    await expectAssertionFailed(async () => testCreateLocalTokenPool(invalidAttestTokenHandlerInfo, CHAIN_ID_ALEPHIUM))
  }, 10000)

  it('should transfer local token', async () => {
    await buildProject()
    const testTokenInfo = createTestToken()
    const fixture = newLocalTokenPoolFixture(remoteChainId, remoteTokenBridgeId, testTokenInfo.contractId)
    const fromAddress = randomAssetAddress()
    const toAddress = randomByte32Hex()
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const nonceHex = nonce()
    const inputAsset = alphAndTokenInputAsset(fromAddress, oneAlph, testTokenInfo.contractId, transferAmount)
    const tokenBridge = fixture.tokenBridgeInfo.contract
    const testResult = await tokenBridge.testPublicMethod('transferToken', {
      address: fixture.tokenBridgeInfo.address,
      initialFields: fixture.tokenBridgeInfo.selfState.fields,
      testArgs: {
        fromAddress: fromAddress,
        bridgeTokenId: testTokenInfo.contractId,
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
      existingContracts: fixture.localTokenPoolInfo.states().concat(testTokenInfo.states())
    })

    const tokenBridgeForChainState = testResult.contracts.find(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )!
    expect(tokenBridgeForChainState.fields['sendSequence']).toEqual(1n)

    // check `totalBridged`
    const localTokenPoolState = testResult.contracts.find(
      (c) => c.contractId === fixture.localTokenPoolInfo.contractId
    )!
    expect(localTokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged + transferAmount)

    const localTokenPoolOutput = testResult.txOutputs[0]
    expect(localTokenPoolOutput.tokens).toEqual([
      {
        id: testTokenInfo.contractId,
        amount: fixture.totalBridged + transferAmount
      }
    ])
    const governanceOutput = testResult.txOutputs[1]
    expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + defaultMessageFee))

    const transferMessage = new Transfer(
      transferAmount,
      testTokenInfo.contractId,
      CHAIN_ID_ALEPHIUM,
      toAddress,
      arbiterFee
    )
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0]
    expect(event.name).toEqual('WormholeMessage')
    expect(event.fields).toEqual({
      sender: fixture.tokenBridgeInfo.contractId,
      targetChainId: BigInt(remoteChainId),
      sequence: 0n,
      nonce: nonceHex,
      payload: binToHex(transferMessage.encode()),
      consistencyLevel: minimalConsistencyLevel
    })
  })

  it('should complete local token transfer', async () => {
    await buildProject()
    const testTokenInfo = createTestToken()
    const fixture = newLocalTokenPoolFixture(remoteChainId, remoteTokenBridgeId, testTokenInfo.contractId)
    const toAddressHex = randomAssetAddressHex()
    const toAddress = hexToBase58(toAddressHex)
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const transfer = new Transfer(transferAmount, testTokenInfo.contractId, CHAIN_ID_ALEPHIUM, toAddressHex, arbiterFee)
    const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 0)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const tokenBridgeForChain = fixture.tokenBridgeForChainInfo.contract

    async function testWithCaller(inputAsset: InputAsset): Promise<TestContractResult> {
      return tokenBridgeForChain.testPublicMethod('completeTransfer', {
        address: fixture.tokenBridgeForChainInfo.address,
        initialFields: fixture.tokenBridgeForChainInfo.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          caller: inputAsset.address
        },
        initialAsset: fixture.tokenBridgeForChainInfo.selfState.asset,
        inputAssets: [inputAsset],
        existingContracts: fixture.localTokenPoolInfo.states().concat(testTokenInfo.states())
      })
    }

    const checkResult = (testResult: TestContractResult) => {
      // check `totalBridged`
      const localTokenPoolState = testResult.contracts.find(
        (c) => c.contractId === fixture.localTokenPoolInfo.contractId
      )!
      expect(localTokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged - transferAmount)

      const tokenBridgeForChainState = testResult.contracts.find(
        (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
      )!
      expect(tokenBridgeForChainState.fields['firstNext256']).toEqual(1n)

      const initAsset = fixture.localTokenPoolInfo.selfState.asset
      const contractOutput = testResult.txOutputs.find((c) => c.address === fixture.localTokenPoolInfo.address)!
      expect(contractOutput.alphAmount).toEqual(initAsset.alphAmount)
      expect(contractOutput.tokens).toEqual([
        {
          id: testTokenInfo.contractId,
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
        id: testTokenInfo.contractId,
        amount: transferAmount - arbiterFee
      }
    ])

    checkTxCallerBalance(testResult0.txOutputs[1], dustAmount, [
      {
        id: testTokenInfo.contractId,
        amount: arbiterFee
      }
    ])

    const testResult1 = await testWithCaller({
      address: toAddress,
      asset: { alphAmount: oneAlph }
    })
    checkResult(testResult1)

    const recipientOutput1 = testResult1.txOutputs.find((c) => c.address === toAddress)!
    expect(BigInt(recipientOutput1.alphAmount)).toEqual(oneAlph - defaultGasFee)
    expect(recipientOutput1.tokens).toEqual([
      {
        id: testTokenInfo.contractId,
        amount: transferAmount
      }
    ])
  })

  it('should create remote token pool', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const fixture = newTokenBridgeFixture()
    const localTokenBridgeId = fixture.tokenBridgeInfo.contractId

    async function testCreateRemoteTokenPool(attestTokenHandlerInfo: ContractInfo, targetChainId: number) {
      const attestToken = new AttestToken(remoteTokenId, remoteChainId, symbol, name, decimals)
      const vaaBody = new VAABody(attestToken.encode(), remoteChainId, targetChainId, remoteTokenBridgeId, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      const result = await attestTokenHandlerInfo.contract.testPublicMethod('createRemoteTokenPool', {
        address: attestTokenHandlerInfo.address,
        initialFields: attestTokenHandlerInfo.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          payer: payer,
          createContractAlphAmount: minimalAlphInContract
        },
        inputAssets: [defaultInputAsset],
        existingContracts: fixture.tokenBridgeInfo.states()
      })

      const remoteTokenPoolAddress = tokenPoolAddress(localTokenBridgeId, remoteChainId, remoteTokenId)
      const remoteTokenPoolState = result.contracts.find((c) => c.address === remoteTokenPoolAddress)!
      expect(remoteTokenPoolState.fields['decimals_']).toEqual(BigInt(decimals))
      expect(remoteTokenPoolState.fields['symbol_']).toEqual(symbol)
      expect(remoteTokenPoolState.fields['name_']).toEqual(name)

      const remoteTokenPoolOutput = result.txOutputs.find((o) => o.address === remoteTokenPoolAddress)!
      expect(remoteTokenPoolOutput.alphAmount).toEqual(minimalAlphInContract)
      const remoteTokenPoolId = binToHex(contractIdFromAddress(remoteTokenPoolAddress))
      expect(remoteTokenPoolOutput.tokens).toEqual([
        {
          id: remoteTokenPoolId,
          amount: tokenMax
        }
      ])
    }

    const attestTokenHandlerInfo = createAttestTokenHandler(fixture.tokenBridgeInfo, remoteChainId, remoteTokenBridgeId)
    await testCreateRemoteTokenPool(attestTokenHandlerInfo, 0)
    await expectAssertionFailed(async () => testCreateRemoteTokenPool(attestTokenHandlerInfo, CHAIN_ID_ALEPHIUM))

    const invalidAttestTokenHandlerInfo = createAttestTokenHandler(fixture.tokenBridgeInfo, CHAIN_ID_ALEPHIUM, localTokenBridgeId)
    await expectAssertionFailed(async () => testCreateRemoteTokenPool(invalidAttestTokenHandlerInfo, 0))
    await expectAssertionFailed(async () => testCreateRemoteTokenPool(invalidAttestTokenHandlerInfo, CHAIN_ID_ALEPHIUM))
  }, 10000)

  it('should update remote token pool', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const fixture = newRemoteTokenPoolFixture(
      remoteChainId,
      remoteTokenBridgeId,
      remoteTokenId,
      symbol,
      name,
      decimals,
      1
    )
    const newSymbol = randomByte32Hex()
    const newName = randomByte32Hex()
    const newDecimals = decimals + 1
    const remoteTokenPool = fixture.remoteTokenPoolInfo.contract
    // invalid caller
    expectError(
      async () =>
        await remoteTokenPool.testPublicMethod('updateDetails', {
          address: fixture.remoteTokenPoolInfo.selfState.address,
          initialFields: fixture.remoteTokenPoolInfo.selfState.fields,
          testArgs: {
            symbol: newSymbol,
            name: newName,
            sequence: 2n
          },
          inputAssets: [defaultInputAsset],
          existingContracts: fixture.remoteTokenPoolInfo.dependencies
        }),
      'ExpectAContract'
    )

    async function update(attestTokenHandlerInfo: ContractInfo, targetChainId: number, sequence: number) {
      const attestToken = new AttestToken(remoteTokenId, remoteChainId, newSymbol, newName, newDecimals)
      const vaaBody = new VAABody(attestToken.encode(), remoteChainId, targetChainId, remoteTokenBridgeId, sequence)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      const result = await attestTokenHandlerInfo.contract.testPublicMethod('updateRemoteTokenPool', {
        address: attestTokenHandlerInfo.address,
        initialFields: attestTokenHandlerInfo.selfState.fields,
        testArgs: {
          vaa: binToHex(vaa.encode()),
          payer: payer,
          createContractAlphAmount: minimalAlphInContract
        },
        inputAssets: [defaultInputAsset],
        existingContracts: fixture.remoteTokenPoolInfo.states()
      })

      const remoteTokenPoolState = result.contracts.find((c) => c.contractId === fixture.remoteTokenPoolInfo.contractId)!
      expect(remoteTokenPoolState.fields['symbol_']).toEqual(newSymbol)
      expect(remoteTokenPoolState.fields['name_']).toEqual(newName)
      expect(remoteTokenPoolState.fields['sequence_']).toEqual(2n)
      expect(remoteTokenPoolState.fields['decimals_']).toEqual(BigInt(decimals)) // decimals never change
    }

    const attestTokenHandlerInfo = createAttestTokenHandler(fixture.tokenBridgeInfo, remoteChainId, remoteTokenBridgeId)
    await update(attestTokenHandlerInfo, 0, 2)
    await expectAssertionFailed(async () => update(attestTokenHandlerInfo, CHAIN_ID_ALEPHIUM, 3)) // invalid chain id
    await expectAssertionFailed(async () => update(attestTokenHandlerInfo, 0, 1)) // invalid sequence
    await expectAssertionFailed(async () => update(attestTokenHandlerInfo, 0, 0)) // invalid sequence

    const invalidAttestTokenHandler = createAttestTokenHandler(fixture.tokenBridgeInfo, CHAIN_ID_ALEPHIUM, fixture.tokenBridgeInfo.contractId)
    await expectAssertionFailed(async () => update(invalidAttestTokenHandler, 0, 2))
    await expectAssertionFailed(async () => update(invalidAttestTokenHandler, CHAIN_ID_ALEPHIUM, 2))
    await expectAssertionFailed(async () => update(invalidAttestTokenHandler, 0, 1))
  }, 20000)

  it('should transfer remote token', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const fixture = newRemoteTokenPoolFixture(
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
    const inputAsset = alphAndTokenInputAsset(
      fromAddress,
      oneAlph,
      fixture.remoteTokenPoolInfo.contractId,
      transferAmount
    )
    const tokenBridge = fixture.tokenBridgeInfo.contract

    async function transferToken(consistencyLevel: bigint) {
      return tokenBridge.testPublicMethod('transferToken', {
        address: fixture.tokenBridgeInfo.address,
        initialFields: fixture.tokenBridgeInfo.selfState.fields,
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
        existingContracts: fixture.remoteTokenPoolInfo.states()
      })
    }

    await expectAssertionFailed(async () => transferToken(minimalConsistencyLevel - 1n))

    const testResult = await transferToken(minimalConsistencyLevel)

    const tokenBridgeForChainState = testResult.contracts.find(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )!
    expect(tokenBridgeForChainState.fields['sendSequence']).toEqual(1n)

    // check `totalBridged`
    const remoteTokenPoolState = testResult.contracts.find(
      (c) => c.contractId === fixture.remoteTokenPoolInfo.contractId
    )!
    expect(remoteTokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged - transferAmount)

    const remoteTokenPoolOutput = testResult.txOutputs[0]
    expect(remoteTokenPoolOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPoolInfo.contractId,
        amount: fixture.totalBridged + transferAmount
      }
    ])

    const governanceOutput = testResult.txOutputs[1]
    expect(BigInt(governanceOutput.alphAmount)).toEqual(minimalAlphInContract + defaultMessageFee)

    const transfer = new Transfer(transferAmount, remoteTokenId, remoteChainId, toAddress, arbiterFee)
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0]
    expect(event.name).toEqual('WormholeMessage')
    expect(event.fields).toEqual({
      sender: fixture.tokenBridgeInfo.contractId,
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
    const fixture = newRemoteTokenPoolFixture(
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
    const inputAsset = alphAndTokenInputAsset(
      fromAddress,
      oneAlph,
      fixture.remoteTokenPoolInfo.contractId,
      transferAmount
    )
    const tokenBridge = fixture.tokenBridgeInfo.contract
    await expectNotEnoughBalance(async () => {
      await tokenBridge.testPublicMethod('transferToken', {
        address: fixture.tokenBridgeInfo.address,
        initialFields: fixture.tokenBridgeInfo.selfState.fields,
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
        existingContracts: fixture.remoteTokenPoolInfo.states()
      })
    })
  })

  it('should complete remote token transfer', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const fixture = newRemoteTokenPoolFixture(
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
    const tokenBridgeForChain = fixture.tokenBridgeForChainInfo.contract
    const testResult = await tokenBridgeForChain.testPublicMethod('completeTransfer', {
      address: fixture.tokenBridgeForChainInfo.address,
      initialFields: fixture.tokenBridgeForChainInfo.selfState.fields,
      testArgs: {
        vaa: binToHex(vaa.encode()),
        caller: payer
      },
      initialAsset: fixture.tokenBridgeForChainInfo.selfState.asset,
      inputAssets: [defaultInputAsset],
      existingContracts: fixture.remoteTokenPoolInfo.states()
    })

    const recipientOutput = testResult.txOutputs.find((c) => c.address === hexToBase58(toAddress))!
    expect(BigInt(recipientOutput.alphAmount)).toEqual(dustAmount)
    expect(recipientOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPoolInfo.contractId,
        amount: transferAmount - arbiterFee
      }
    ])

    checkTxCallerBalance(testResult.txOutputs[1], dustAmount, [
      {
        id: fixture.remoteTokenPoolInfo.contractId,
        amount: arbiterFee
      }
    ])

    // check `totalBridged`
    const remoteTokenPoolState = testResult.contracts.find(
      (c) => c.contractId === fixture.remoteTokenPoolInfo.contractId
    )!
    expect(remoteTokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged + transferAmount)

    const tokenBridgeForChainState = testResult.contracts.find(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )!
    expect(tokenBridgeForChainState.fields['firstNext256']).toEqual(1n)

    const contractOutput = testResult.txOutputs.find((c) => c.address === fixture.remoteTokenPoolInfo.address)!
    expect(contractOutput.alphAmount).toEqual(fixture.remoteTokenPoolInfo.selfState.asset.alphAmount)
    expect(contractOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPoolInfo.contractId,
        amount: fixture.totalBridged - transferAmount
      }
    ])
  })

  it('should failed to complete transfer and create unexecuted sequence contracts', async () => {
    await buildProject()
    const testTokenInfo = createTestToken()
    const fixture = newLocalTokenPoolFixture(remoteChainId, remoteTokenBridgeId, testTokenInfo.contractId)
    const toAddress = randomAssetAddressHex()
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const transfer = new Transfer(transferAmount, testTokenInfo.contractId, CHAIN_ID_ALEPHIUM, toAddress, arbiterFee)
    const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 768)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const tokenBridgeForChain = fixture.tokenBridgeForChainInfo.contract
    const testResult = await tokenBridgeForChain.testPublicMethod('completeTransfer', {
      address: fixture.tokenBridgeForChainInfo.address,
      initialFields: fixture.tokenBridgeForChainInfo.selfState.fields,
      testArgs: {
        vaa: binToHex(vaa.encode()),
        caller: payer
      },
      initialAsset: fixture.tokenBridgeForChainInfo.selfState.asset,
      inputAssets: [defaultInputAsset],
      existingContracts: fixture.localTokenPoolInfo.states().concat(testTokenInfo.states())
    })

    const tokenBridgeForChainState = testResult.contracts.find(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )!
    expect(tokenBridgeForChainState.fields['start']).toEqual(256n)
    expect(tokenBridgeForChainState.fields['firstNext256']).toEqual(0n)
    expect(tokenBridgeForChainState.fields['secondNext256']).toEqual(0n)

    // the locked assets have not changed
    const tokenPoolState = testResult.contracts.find((c) => c.address === fixture.localTokenPoolInfo.address)!
    const tokenPoolInitAsset = fixture.localTokenPoolInfo.selfState.asset
    expect(tokenPoolState.asset.alphAmount).toEqual(tokenPoolInitAsset.alphAmount)
    expect(tokenPoolState.asset.tokens).toEqual(tokenPoolInitAsset.tokens)

    const unexecutedSequenceContractId = subContractId(
      fixture.tokenBridgeForChainInfo.contractId,
      '0000000000000000',
      0
    )
    const unexecutedSequenceState = testResult.contracts.find((c) => c.contractId === unexecutedSequenceContractId)!
    expect(unexecutedSequenceState.fields['begin']).toEqual(0n)
    expect(unexecutedSequenceState.fields['sequences']).toEqual(0n)

    checkTxCallerBalance(testResult.txOutputs.find((c) => c.address === payer)!, 0n)
  })

  it('should allow transfer wrapped token to non-original chain', async () => {
    await buildProject()
    const remoteTokenId = randomByte32Hex()
    const chainB = CHAIN_ID_ALEPHIUM + 1 // token chain id
    const chainC = CHAIN_ID_ALEPHIUM + 2 // to chain id
    const fixture = newRemoteTokenPoolFixture(chainB, remoteTokenBridgeId, remoteTokenId, symbol, name, decimals, 0)
    const chainCTokenBridgeId = randomByte32Hex()
    const tokenBridgeForChainCInfo = createTokenBridgeForChain(fixture.tokenBridgeInfo, chainC, chainCTokenBridgeId)
    const fromAddress = randomAssetAddress()
    const toAddress = randomByte32Hex()
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const nonceHex = nonce()
    const inputAsset = alphAndTokenInputAsset(
      fromAddress,
      oneAlph,
      fixture.remoteTokenPoolInfo.contractId,
      transferAmount
    )
    const tokenBridge = fixture.tokenBridgeInfo.contract

    async function transferToken(consistencyLevel: bigint) {
      return tokenBridge.testPublicMethod('transferToken', {
        address: fixture.tokenBridgeInfo.address,
        initialFields: fixture.tokenBridgeInfo.selfState.fields,
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
        existingContracts: [...fixture.remoteTokenPoolInfo.states(), ...tokenBridgeForChainCInfo.states()]
      })
    }

    const testResult = await transferToken(minimalConsistencyLevel)

    const tokenBridgeForChainBState = testResult.contracts.find(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )!
    expect(tokenBridgeForChainBState.fields['sendSequence']).toEqual(0n)

    const tokenBridgeForChainCState = testResult.contracts.find(
      (c) => c.contractId === tokenBridgeForChainCInfo.contractId
    )!
    expect(tokenBridgeForChainCState.fields['sendSequence']).toEqual(1n)

    // check `totalBridged`
    const remoteTokenPoolState = testResult.contracts.find(
      (c) => c.contractId === fixture.remoteTokenPoolInfo.contractId
    )!
    expect(remoteTokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged - transferAmount)

    const remoteTokenPoolOutput = testResult.txOutputs[0]
    expect(remoteTokenPoolOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPoolInfo.contractId,
        amount: fixture.totalBridged + transferAmount
      }
    ])

    const governanceOutput = testResult.txOutputs[1]
    expect(BigInt(governanceOutput.alphAmount)).toEqual(minimalAlphInContract + defaultMessageFee)

    const transfer = new Transfer(transferAmount, remoteTokenId, chainB, toAddress, arbiterFee)
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0]
    expect(event.name).toEqual('WormholeMessage')
    expect(event.fields).toEqual({
      sender: fixture.tokenBridgeInfo.contractId,
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
    const fixture = newRemoteTokenPoolFixture(chainB, remoteTokenBridgeId, remoteTokenId, symbol, name, decimals, 0)
    const chainCTokenBridgeId = randomByte32Hex()
    const tokenBridgeForChainCInfo = createTokenBridgeForChain(fixture.tokenBridgeInfo, chainC, chainCTokenBridgeId)
    const toAddress = randomAssetAddressHex()
    const transferAmount = oneAlph
    const arbiterFee = defaultMessageFee
    const transfer = new Transfer(transferAmount, remoteTokenId, chainB, toAddress, arbiterFee)
    const vaaBody = new VAABody(transfer.encode(), chainC, CHAIN_ID_ALEPHIUM, chainCTokenBridgeId, 0)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const tokenBridgeForChainC = tokenBridgeForChainCInfo.contract
    const testResult = await tokenBridgeForChainC.testPublicMethod('completeTransfer', {
      address: tokenBridgeForChainCInfo.address,
      initialFields: tokenBridgeForChainCInfo.selfState.fields,
      testArgs: {
        vaa: binToHex(vaa.encode()),
        caller: payer
      },
      initialAsset: tokenBridgeForChainCInfo.selfState.asset,
      inputAssets: [defaultInputAsset],
      existingContracts: [...fixture.remoteTokenPoolInfo.states(), ...tokenBridgeForChainCInfo.states()]
    })

    const recipientOutput = testResult.txOutputs.find((c) => c.address === hexToBase58(toAddress))!
    expect(BigInt(recipientOutput.alphAmount)).toEqual(dustAmount)
    expect(recipientOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPoolInfo.contractId,
        amount: transferAmount - arbiterFee
      }
    ])

    checkTxCallerBalance(testResult.txOutputs[1], dustAmount, [
      {
        id: fixture.remoteTokenPoolInfo.contractId,
        amount: arbiterFee
      }
    ])

    // check `totalBridged`
    const remoteTokenPoolState = testResult.contracts.find(
      (c) => c.contractId === fixture.remoteTokenPoolInfo.contractId
    )!
    expect(remoteTokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged + transferAmount)

    // check `TokenBridgeForChain` sequences
    const tokenBridgeForChainBState = testResult.contracts.find(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )!
    expect(tokenBridgeForChainBState.fields['firstNext256']).toEqual(0n)

    const tokenBridgeForChainCState = testResult.contracts.find(
      (c) => c.contractId === tokenBridgeForChainCInfo.contractId
    )!
    expect(tokenBridgeForChainCState.fields['firstNext256']).toEqual(1n)

    const contractOutput = testResult.txOutputs.find((c) => c.address === fixture.remoteTokenPoolInfo.address)!
    expect(contractOutput.alphAmount).toEqual(oneAlph)
    expect(contractOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPoolInfo.contractId,
        amount: fixture.totalBridged - transferAmount
      }
    ])
  })

  it('should destroy unexecuted sequence contracts', async () => {
    await buildProject()
    const fixture = newTokenBridgeForChainFixture(remoteChainId, remoteTokenBridgeId)
    const paths = [0, 1, 2, 5, 8]
    const subContracts: ContractState[] = []
    for (const path of paths) {
      const unexecutedSequenceContractId = subContractId(
        fixture.tokenBridgeForChainInfo.contractId,
        zeroPad(path.toString(16), 8),
        0
      )
      const contractInfo = createUnexecutedSequence(
        fixture.tokenBridgeForChainInfo.contractId,
        BigInt(path * 256),
        0n,
        unexecutedSequenceContractId
      )
      subContracts.push(contractInfo.selfState)
    }
    const existingContracts = Array.prototype.concat(fixture.tokenBridgeForChainInfo.states(), subContracts)
    const destroyUnexecutedSequenceContracts = new DestroyUnexecutedSequenceContracts(remoteChainId, paths)
    const vaaBody = new VAABody(
      destroyUnexecutedSequenceContracts.encode(),
      governanceChainId,
      CHAIN_ID_ALEPHIUM,
      governanceEmitterAddress,
      0
    )
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const tokenBridge = fixture.tokenBridgeInfo.contract
    const testResult = await tokenBridge.testPublicMethod('destroyUnexecutedSequenceContracts', {
      address: fixture.tokenBridgeInfo.address,
      initialFields: fixture.tokenBridgeInfo.selfState.fields,
      testArgs: { vaa: binToHex(vaa.encode()) },
      inputAssets: [defaultInputAsset],
      existingContracts: existingContracts
    })

    expect(testResult.events.length).toEqual(paths.length)
    testResult.events.forEach((event, index) => {
      expect(event.name).toEqual('ContractDestroyed')
      expect(event.fields['address']).toEqual(subContracts[index].address)
    })
    const refundAlphAmount = BigInt(paths.length) * oneAlph
    const expectedAlphAmount = BigInt(fixture.tokenBridgeForChainInfo.selfState.asset.alphAmount) + refundAlphAmount
    expect(testResult.txOutputs[0].address).toEqual(fixture.tokenBridgeForChainInfo.address)
    expect(testResult.txOutputs[0].alphAmount).toEqual(expectedAlphAmount)
  })

  it('should test upgrade contract', async () => {
    await buildProject()
    const tokenBridgeInfo = createTokenBridge()
    const tokenBridge = tokenBridgeInfo.contract

    async function upgrade(contractUpgrade: ContractUpgrade): Promise<TestContractResult> {
      const vaaBody = new VAABody(
        contractUpgrade.encode(tokenBridgeModule, 2),
        governanceChainId,
        CHAIN_ID_ALEPHIUM,
        governanceEmitterAddress,
        0
      )
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      return tokenBridge.testPublicMethod('upgradeContract', {
        address: tokenBridgeInfo.address,
        initialFields: tokenBridgeInfo.selfState.fields,
        testArgs: { vaa: binToHex(vaa.encode()) },
        initialAsset: { alphAmount: oneAlph },
        existingContracts: tokenBridgeInfo.dependencies
      })
    }

    {
      const v1 = Project.contract('TokenBridgeV1')
      const newContractCode = v1.bytecode
      const contractUpgrade = new ContractUpgrade(newContractCode)
      const testResult = await upgrade(contractUpgrade)
      const newContract = testResult.contracts[testResult.contracts.length - 1]
      expect(newContract.address).toEqual(tokenBridgeInfo.address)
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
      const newContractCode = v2.bytecode
      const receivedSequence = tokenBridgeInfo.selfState.fields['receivedSequence'] as bigint
      const sendSequence = tokenBridgeInfo.selfState.fields['sendSequence'] as bigint
      const consistency = Number(tokenBridgeInfo.selfState.fields['minimalConsistencyLevel'] as bigint)
      const refundAddress = tokenBridgeInfo.selfState.fields['refundAddress'] as string
      const prevEncodedState = Buffer.concat([
        encodeU256(BigInt(receivedSequence) + 1n),
        encodeU256(sendSequence),
        encodeUint8(consistency),
        base58.decode(refundAddress)
      ])
      const prevStateHash = Buffer.from(blake.blake2b(prevEncodedState, undefined, 32)).toString('hex')
      const newState = '00'
      const contractUpgrade = new ContractUpgrade(newContractCode, prevStateHash, newState)
      const testResult = await upgrade(contractUpgrade)
      const newContract = testResult.contracts[testResult.contracts.length - 1]
      expect(newContract.address).toEqual(tokenBridgeInfo.address)
      expect(newContract.bytecode).toEqual(newContractCode)
      expect(newContract.fields).toEqual({})
    }
  })

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
    const fixture = newTokenBridgeFixture()

    async function updateRefundAddress(targetChainId: number, newRefundAddressHex: string) {
      const newRefundAddress = base58.encode(Buffer.from(newRefundAddressHex, 'hex'))
      expect(fixture.tokenBridgeInfo.selfState.fields['refundAddress']).not.toEqual(newRefundAddress)
      const updateRefundAddress = new UpdateRefundAddress(newRefundAddressHex)
      const vaaBody = new VAABody(
        updateRefundAddress.encode(),
        governanceChainId,
        targetChainId,
        governanceEmitterAddress,
        0
      )
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      const tokenBridge = fixture.tokenBridgeInfo.contract
      const result = await tokenBridge.testPublicMethod('updateRefundAddress', {
        address: fixture.tokenBridgeInfo.address,
        initialFields: fixture.tokenBridgeInfo.selfState.fields,
        testArgs: { vaa: binToHex(vaa.encode()) },
        initialAsset: { alphAmount: oneAlph },
        existingContracts: fixture.tokenBridgeInfo.dependencies
      })
      const tokenBridgeState = result.contracts.find((c) => c.address === fixture.tokenBridgeInfo.address)!
      expect(tokenBridgeState.fields['refundAddress']).toEqual(newRefundAddress)
    }

    const p2pkhAddressHex = randomP2PKHAddressHex()
    await updateRefundAddress(CHAIN_ID_ALEPHIUM, p2pkhAddressHex)
    await expectAssertionFailed(async () => updateRefundAddress(CHAIN_ID_ALEPHIUM + 1, p2pkhAddressHex)) // invalid chain id

    await updateRefundAddress(CHAIN_ID_ALEPHIUM, randomP2MPKHAddressHex(3, 5))
    await updateRefundAddress(CHAIN_ID_ALEPHIUM, randomP2SHAddressHex())
    await expectAssertionFailed(async () => updateRefundAddress(CHAIN_ID_ALEPHIUM, randomP2CAddressHex())) // p2c address
  })

  it('should test deposit/withdraw', async () => {
    await buildProject()
    const fixture = newTokenBridgeForChainFixture(remoteChainId, randomByte32Hex())
    const tokenBridgeForChain = fixture.tokenBridgeForChainInfo.contract
    const testResult0 = await tokenBridgeForChain.testPublicMethod('deposit', {
      initialFields: fixture.tokenBridgeForChainInfo.selfState.fields,
      initialAsset: { alphAmount: oneAlph },
      address: fixture.tokenBridgeForChainInfo.address,
      testArgs: {
        from: payer,
        alphAmount: alph(3)
      },
      inputAssets: [{ address: payer, asset: { alphAmount: alph(4) } }],
      existingContracts: fixture.tokenBridgeForChainInfo.dependencies
    })
    const contractState0 = testResult0.contracts.find((c) => c.address === fixture.tokenBridgeForChainInfo.address)!
    expect(contractState0.asset).toEqual({ alphAmount: alph(4), tokens: [] })
    const payerOutput = testResult0.txOutputs.find((c) => c.address === payer)!
    expect(payerOutput.alphAmount).toEqual(oneAlph - defaultGasFee)

    const refundAddress = fixture.tokenBridgeInfo.selfState.fields['refundAddress'] as string
    const testResult1 = await tokenBridgeForChain.testPublicMethod('withdraw', {
      initialFields: fixture.tokenBridgeForChainInfo.selfState.fields,
      initialAsset: { alphAmount: alph(4) },
      address: fixture.tokenBridgeForChainInfo.address,
      testArgs: { alphAmount: alph(3) },
      inputAssets: [{ address: refundAddress, asset: { alphAmount: oneAlph } }],
      existingContracts: fixture.tokenBridgeForChainInfo.dependencies
    })
    const contractState1 = testResult1.contracts.find((c) => c.address === fixture.tokenBridgeForChainInfo.address)!
    expect(contractState1.asset).toEqual({ alphAmount: oneAlph, tokens: [] })
    const refundAddressOutput = testResult1.txOutputs.find((c) => c.address === refundAddress)!
    expect(refundAddressOutput.alphAmount).toEqual(alph(4) - defaultGasFee)
  })
})

import {
  Asset,
  InputAsset,
  Output,
  TestContractResult,
  Token,
  subContractId,
  ContractState,
  contractIdFromAddress,
  binToHex,
  addressFromContractId,
  Project,
  web3,
  encodeI256
} from '@alephium/web3'
import { nonce, zeroPad } from '../lib/utils'
import { governanceChainId, governanceEmitterAddress, initGuardianSet, messageFee } from './fixtures/governance-fixture'
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
  newWrappedAlphPoolFixture,
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
  randomAssetAddress,
  toRecipientId,
  u256Max,
  VAABody,
  dustAmount,
  defaultGasFee,
  randomContractId,
  randomContractAddress,
  expectNotEnoughBalance,
  alph,
  buildProject,
  expectError
} from './fixtures/wormhole-fixture'
import { randomBytes } from 'crypto'
import * as blake from 'blakejs'
import { createUnexecutedSequence } from './fixtures/sequence-fixture'
import * as base58 from 'bs58'

describe('test token bridge', () => {
  web3.setCurrentNodeProvider('http://127.0.0.1:22973')

  const payer = randomAssetAddress()
  const defaultInputAsset: InputAsset = alphInputAsset(payer, alph(4))

  function randomByte32Hex(): string {
    return binToHex(randomBytes(32))
  }

  function randomP2PKHAddressHex(): string {
    return '00' + randomByte32Hex()
  }

  function randomP2MPKHAddressHex(m: number, n: number): string {
    let hex: string = '01' + binToHex(encodeI256(BigInt(n)))
    for (let i = 0; i < n; i += 1) {
      hex += randomByte32Hex()
    }
    return hex + binToHex(encodeI256(BigInt(m)))
  }

  function randomP2SHAddressHex(): string {
    return '02' + randomByte32Hex()
  }

  function randomP2CAddressHex(): string {
    return '03' + randomByte32Hex()
  }

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
        nonce: nonceHex,
        consistencyLevel: 0
      },
      inputAssets: [inputAsset],
      existingContracts: tokenBridgeInfo.dependencies.concat(testToken.states())
    })
    const governanceOutput = testResult.txOutputs[0]
    expect(governanceOutput.address).toEqual(tokenBridgeInfo.governance.address)
    expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + messageFee))

    const byte32Zero = '0'.repeat(64)
    const message = new AttestToken(testToken.contractId, CHAIN_ID_ALEPHIUM, byte32Zero, byte32Zero, 0)
    const events = testResult.events
    expect(events.length).toEqual(1)
    expect(events[0].name).toEqual('WormholeMessage')
    expect(events[0].fields).toEqual({
      sender: tokenBridgeInfo.contractId,
      targetChainId: 0,
      sequence: 0,
      nonce: nonceHex,
      payload: binToHex(message.encode()),
      consistencyLevel: 0
    })
  })

  it('should attest wrapped alph', async () => {
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
        localTokenId: tokenBridgeInfo.wrappedAlphId,
        nonce: nonceHex,
        consistencyLevel: 0
      },
      inputAssets: [inputAsset],
      existingContracts: tokenBridgeInfo.dependencies
    })
    const governanceOutput = testResult.txOutputs[0]
    expect(governanceOutput.address).toEqual(tokenBridgeInfo.governance.address)
    expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + messageFee))

    const byte32Zero = '0'.repeat(64)
    const message = new AttestToken(tokenBridgeInfo.wrappedAlphId, CHAIN_ID_ALEPHIUM, byte32Zero, byte32Zero, 0)
    const events = testResult.events
    expect(events.length).toEqual(1)
    expect(events[0].name).toEqual('WormholeMessage')
    expect(events[0].fields).toEqual({
      sender: tokenBridgeInfo.contractId,
      targetChainId: 0,
      sequence: 0,
      nonce: nonceHex,
      payload: binToHex(message.encode()),
      consistencyLevel: 0
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

    const tokenBridgeState = testResult.contracts.filter((c) => c.contractId === tokenBridgeInfo.contractId)[0]
    expect(tokenBridgeState.fields['minimalConsistencyLevel']).toEqual(newMinimalConsistencyLevel)
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
    const tokenBridgeInfo = createTokenBridge(0n, undefined, 3)
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
  })

  it('should create wrapped alph pool', async () => {
    await buildProject()
    const fixture = newTokenBridgeFixture()
    const wrappedAlphId = fixture.tokenBridgeInfo.wrappedAlphId
    const tokenBridge = fixture.tokenBridgeInfo.contract
    const testResult = await tokenBridge.testPublicMethod('createLocalTokenPool', {
      address: fixture.tokenBridgeInfo.address,
      initialFields: fixture.tokenBridgeInfo.selfState.fields,
      testArgs: {
        localTokenId: wrappedAlphId,
        payer: payer,
        createContractAlphAmount: minimalAlphInContract
      },
      inputAssets: [defaultInputAsset],
      existingContracts: fixture.tokenBridgeInfo.dependencies
    })

    const tokenPoolOutput = testResult.txOutputs[0]
    const expectedAddress = tokenPoolAddress(fixture.tokenBridgeInfo.contractId, CHAIN_ID_ALEPHIUM, wrappedAlphId)
    expect(tokenPoolOutput.address).toEqual(expectedAddress)
    expect(BigInt(tokenPoolOutput.alphAmount)).toEqual(minimalAlphInContract)
    expect(tokenPoolOutput.tokens).toEqual([])
  })

  it('should transfer alph to remote chain', async () => {
    await buildProject()
    const fixture = newWrappedAlphPoolFixture(remoteChainId, remoteTokenBridgeId)
    const wrappedAlphId = fixture.tokenBridgeInfo.wrappedAlphId
    const fromAddress = randomAssetAddress()
    const toAddress = randomByte32Hex()
    const transferAmount = oneAlph
    const arbiterFee = messageFee
    const nonceHex = nonce()
    const inputAsset = alphInputAsset(fromAddress, transferAmount * 2n)
    const tokenBridge = fixture.tokenBridgeInfo.contract
    const testResult = await tokenBridge.testPublicMethod('transferAlph', {
      address: fixture.tokenBridgeInfo.address,
      initialFields: fixture.tokenBridgeInfo.selfState.fields,
      testArgs: {
        fromAddress: fromAddress,
        toChainId: remoteChainId,
        toAddress: toAddress,
        alphAmount: transferAmount,
        arbiterFee: arbiterFee,
        nonce: nonceHex,
        consistencyLevel: minimalConsistencyLevel
      },
      inputAssets: [inputAsset],
      existingContracts: fixture.wrappedAlphPoolInfo.states()
    })

    const tokenBridgeForChainState = testResult.contracts.filter(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )[0]
    expect(tokenBridgeForChainState.fields['sendSequence']).toEqual(1)

    // check `totalBridged`
    const tokenPoolState = testResult.contracts.filter(
      (c) => c.contractId === fixture.wrappedAlphPoolInfo.contractId
    )[0]
    expect(tokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged + transferAmount)

    // check `totalWrapped`
    const wrappedAlphState = testResult.contracts.filter((c) => c.contractId === wrappedAlphId)[0]
    expect(wrappedAlphState.fields['totalWrapped']).toEqual(fixture.totalBridged + transferAmount)

    const wrappedAlphOutput = testResult.txOutputs.filter((c) => c.address === addressFromContractId(wrappedAlphId))[0]
    expect(wrappedAlphOutput.alphAmount).toEqual(fixture.totalWrappedAlph + transferAmount)
    expect(wrappedAlphOutput.tokens).toEqual([
      {
        id: wrappedAlphId,
        amount: fixture.totalWrappedAlph - transferAmount
      }
    ])

    const tokenPoolOutput = testResult.txOutputs.filter((c) => c.address === fixture.wrappedAlphPoolInfo.address)[0]
    expect(tokenPoolOutput.tokens).toEqual([
      {
        id: wrappedAlphId,
        amount: fixture.totalBridged + transferAmount
      }
    ])
    const governanceOutput = testResult.txOutputs.filter(
      (c) => c.address === fixture.tokenBridgeInfo.governance.address
    )[0]
    expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + messageFee))

    const transferMessage = new Transfer(transferAmount, wrappedAlphId, CHAIN_ID_ALEPHIUM, toAddress, arbiterFee)
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0]
    expect(event.name).toEqual('WormholeMessage')
    expect(event.fields).toEqual({
      sender: fixture.tokenBridgeInfo.contractId,
      targetChainId: remoteChainId,
      sequence: 0,
      nonce: nonceHex,
      payload: binToHex(transferMessage.encode()),
      consistencyLevel: minimalConsistencyLevel
    })
  })

  it('should complete transfer alph', async () => {
    await buildProject()
    const fixture = newWrappedAlphPoolFixture(remoteChainId, remoteTokenBridgeId)
    const wrappedAlphId = fixture.tokenBridgeInfo.wrappedAlphId
    const toAddress = randomAssetAddress()
    const transferAmount = oneAlph
    const arbiterFee = messageFee
    const transfer = new Transfer(
      transferAmount,
      wrappedAlphId,
      CHAIN_ID_ALEPHIUM,
      toRecipientId(toAddress),
      arbiterFee
    )
    const vaaBody = new VAABody(transfer.encode(), remoteChainId, CHAIN_ID_ALEPHIUM, remoteTokenBridgeId, 0)
    const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
    const tokenBridgeForChain = fixture.tokenBridgeForChainInfo.contract

    const testResult = await tokenBridgeForChain.testPublicMethod('completeTransfer', {
      address: fixture.tokenBridgeForChainInfo.address,
      initialFields: fixture.tokenBridgeForChainInfo.selfState.fields,
      testArgs: {
        vaa: binToHex(vaa.encode()),
        caller: defaultInputAsset.address
      },
      initialAsset: fixture.tokenBridgeForChainInfo.selfState.asset,
      inputAssets: [defaultInputAsset],
      existingContracts: fixture.wrappedAlphPoolInfo.states()
    })

    // check `totalBridged`
    const tokenPoolState = testResult.contracts.filter(
      (c) => c.contractId === fixture.wrappedAlphPoolInfo.contractId
    )[0]
    expect(tokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged - transferAmount)

    // check `totalWrapped`
    const wrappedAlphState = testResult.contracts.filter((c) => c.contractId === wrappedAlphId)[0]
    expect(wrappedAlphState.fields['totalWrapped']).toEqual(fixture.totalWrappedAlph - transferAmount)

    const tokenBridgeForChainState = testResult.contracts.filter(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )[0]
    expect(tokenBridgeForChainState.fields['firstNext256']).toEqual(1)

    const wrappedAlphOutput = testResult.txOutputs.filter((c) => c.address === addressFromContractId(wrappedAlphId))[0]
    expect(wrappedAlphOutput.alphAmount).toEqual(fixture.totalWrappedAlph - transferAmount)
    expect(wrappedAlphOutput.tokens).toEqual([
      {
        id: wrappedAlphId,
        amount: fixture.totalWrappedAlph + transferAmount
      }
    ])

    const recipientOutput = testResult.txOutputs.filter((c) => c.address === toAddress)[0]
    expect(BigInt(recipientOutput.alphAmount)).toEqual(transferAmount - arbiterFee + dustAmount)

    const callerOutput = testResult.txOutputs.filter((c) => c.address === defaultInputAsset.address)[0]
    checkTxCallerBalance(callerOutput, dustAmount - arbiterFee)

    const tokenPoolOutput = testResult.txOutputs.filter((c) => c.address === fixture.wrappedAlphPoolInfo.address)[0]
    expect(tokenPoolOutput.tokens).toEqual([
      {
        id: wrappedAlphId,
        amount: fixture.totalBridged - transferAmount
      }
    ])
  })

  it('should create local token pool', async () => {
    await buildProject()
    const fixture = newTokenBridgeFixture()
    const testToken = createTestToken()
    const tokenBridge = fixture.tokenBridgeInfo.contract
    const inputAsset = alphAndTokenInputAsset(payer, alph(2), testToken.contractId, 1n)
    const testResult = await tokenBridge.testPublicMethod('createLocalTokenPool', {
      address: fixture.tokenBridgeInfo.address,
      initialFields: fixture.tokenBridgeInfo.selfState.fields,
      testArgs: {
        localTokenId: testToken.contractId,
        payer: payer,
        createContractAlphAmount: minimalAlphInContract
      },
      inputAssets: [inputAsset],
      existingContracts: fixture.tokenBridgeInfo.dependencies.concat(testToken.states())
    })

    const tokenPoolOutput = testResult.txOutputs[0]
    const expectedAddress = tokenPoolAddress(
      fixture.tokenBridgeInfo.contractId,
      CHAIN_ID_ALEPHIUM,
      testToken.contractId
    )
    expect(tokenPoolOutput.address).toEqual(expectedAddress)
    expect(BigInt(tokenPoolOutput.alphAmount)).toEqual(minimalAlphInContract)
    expect(tokenPoolOutput.tokens).toEqual([])
  })

  it('should transfer local token', async () => {
    await buildProject()
    const testTokenInfo = createTestToken()
    const fixture = newLocalTokenPoolFixture(remoteChainId, remoteTokenBridgeId, testTokenInfo.contractId)
    const fromAddress = randomAssetAddress()
    const toAddress = randomByte32Hex()
    const transferAmount = oneAlph
    const arbiterFee = messageFee
    const nonceHex = nonce()
    const inputAsset = alphAndTokenInputAsset(fromAddress, oneAlph, testTokenInfo.contractId, transferAmount)
    const tokenBridge = fixture.tokenBridgeInfo.contract
    const testResult = await tokenBridge.testPublicMethod('transferToken', {
      address: fixture.tokenBridgeInfo.address,
      initialFields: fixture.tokenBridgeInfo.selfState.fields,
      testArgs: {
        fromAddress: fromAddress,
        bridgeTokenId: testTokenInfo.contractId,
        tokenChainId: CHAIN_ID_ALEPHIUM,
        toChainId: remoteChainId,
        toAddress: toAddress,
        tokenAmount: transferAmount,
        arbiterFee: arbiterFee,
        nonce: nonceHex,
        consistencyLevel: minimalConsistencyLevel
      },
      inputAssets: [inputAsset],
      existingContracts: fixture.localTokenPoolInfo.states().concat(testTokenInfo.states())
    })

    const tokenBridgeForChainState = testResult.contracts.filter(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )[0]
    expect(tokenBridgeForChainState.fields['sendSequence']).toEqual(1)

    // check `totalBridged`
    const localTokenPoolState = testResult.contracts.filter(
      (c) => c.contractId === fixture.localTokenPoolInfo.contractId
    )[0]
    expect(localTokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged + transferAmount)

    const localTokenPoolOutput = testResult.txOutputs[0]
    expect(localTokenPoolOutput.tokens).toEqual([
      {
        id: testTokenInfo.contractId,
        amount: fixture.totalBridged + transferAmount
      }
    ])
    const governanceOutput = testResult.txOutputs[1]
    expect(BigInt(governanceOutput.alphAmount)).toEqual(BigInt(minimalAlphInContract + messageFee))

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
      targetChainId: remoteChainId,
      sequence: 0,
      nonce: nonceHex,
      payload: binToHex(transferMessage.encode()),
      consistencyLevel: minimalConsistencyLevel
    })
  })

  it('should complete local token transfer', async () => {
    await buildProject()
    const testTokenInfo = createTestToken()
    const fixture = newLocalTokenPoolFixture(remoteChainId, remoteTokenBridgeId, testTokenInfo.contractId)
    const toAddress = randomAssetAddress()
    const transferAmount = oneAlph
    const arbiterFee = messageFee
    const transfer = new Transfer(
      transferAmount,
      testTokenInfo.contractId,
      CHAIN_ID_ALEPHIUM,
      toRecipientId(toAddress),
      arbiterFee
    )
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
      const localTokenPoolState = testResult.contracts.filter(
        (c) => c.contractId === fixture.localTokenPoolInfo.contractId
      )[0]
      expect(localTokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged - transferAmount)

      const tokenBridgeForChainState = testResult.contracts.filter(
        (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
      )[0]
      expect(tokenBridgeForChainState.fields['firstNext256']).toEqual(1)

      const initAsset = fixture.localTokenPoolInfo.selfState.asset
      const contractOutput = testResult.txOutputs.filter((c) => c.address === fixture.localTokenPoolInfo.address)[0]
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

    const recipientOutput0 = testResult0.txOutputs.filter((c) => c.address === toAddress)[0]
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
        amount: Number(arbiterFee)
      }
    ])

    const testResult1 = await testWithCaller({
      address: toAddress,
      asset: { alphAmount: oneAlph }
    })
    checkResult(testResult1)

    const recipientOutput1 = testResult1.txOutputs.filter((c) => c.address === toAddress)[0]
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

    const attestTokenHandlerInfo = createAttestTokenHandler(fixture.tokenBridgeInfo, remoteChainId, remoteTokenBridgeId)
    const attestTokenHandler = attestTokenHandlerInfo.contract
    async function test(targetChainId: number) {
      const attestToken = new AttestToken(remoteTokenId, remoteChainId, symbol, name, decimals)
      const vaaBody = new VAABody(attestToken.encode(), remoteChainId, targetChainId, remoteTokenBridgeId, 0)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      return attestTokenHandler.testPublicMethod('createRemoteTokenPool', {
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
    }

    const testResult = await test(0)
    const tokenPoolOutput = testResult.txOutputs[0]
    const expectedAddress = tokenPoolAddress(fixture.tokenBridgeInfo.contractId, remoteChainId, remoteTokenId)
    expect(tokenPoolOutput.address).toEqual(expectedAddress)
    expect(BigInt(tokenPoolOutput.alphAmount)).toEqual(minimalAlphInContract)
    const tokenPoolId = binToHex(contractIdFromAddress(expectedAddress))
    expect(tokenPoolOutput.tokens).toEqual([
      {
        id: tokenPoolId,
        amount: u256Max
      }
    ])

    await expectAssertionFailed(async () => test(CHAIN_ID_ALEPHIUM))
  })

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
            sequence: 2
          },
          inputAssets: [defaultInputAsset],
          existingContracts: fixture.remoteTokenPoolInfo.dependencies
        }),
      'ExpectAContract'
    )

    const attestTokenHandlerInfo = createAttestTokenHandler(fixture.tokenBridgeInfo, remoteChainId, remoteTokenBridgeId)
    const attestTokenHandler = attestTokenHandlerInfo.contract
    async function update(targetChainId: number, sequence: number) {
      const attestToken = new AttestToken(remoteTokenId, remoteChainId, newSymbol, newName, newDecimals)
      const vaaBody = new VAABody(attestToken.encode(), remoteChainId, targetChainId, remoteTokenBridgeId, sequence)
      const vaa = initGuardianSet.sign(initGuardianSet.quorumSize(), vaaBody)
      return attestTokenHandler.testPublicMethod('updateRemoteTokenPool', {
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
    }

    const result = await update(0, 2)
    const remoteTokenPoolState = result.contracts.find((c) => c.contractId === fixture.remoteTokenPoolInfo.contractId)!
    expect(remoteTokenPoolState.fields['symbol_']).toEqual(newSymbol)
    expect(remoteTokenPoolState.fields['name_']).toEqual(newName)
    expect(remoteTokenPoolState.fields['sequence_']).toEqual(2)
    expect(remoteTokenPoolState.fields['decimals_']).toEqual(decimals) // decimals never change

    await expectAssertionFailed(async () => update(CHAIN_ID_ALEPHIUM, 3)) // invalid chain id
    await expectAssertionFailed(async () => update(0, 1)) // invalid sequence
    await expectAssertionFailed(async () => update(0, 0)) // invalid sequence
  })

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
    const arbiterFee = messageFee
    const nonceHex = nonce()
    const inputAsset = alphAndTokenInputAsset(
      fromAddress,
      oneAlph,
      fixture.remoteTokenPoolInfo.contractId,
      transferAmount
    )
    const tokenBridge = fixture.tokenBridgeInfo.contract

    async function transferToken(consistencyLevel: number) {
      return tokenBridge.testPublicMethod('transferToken', {
        address: fixture.tokenBridgeInfo.address,
        initialFields: fixture.tokenBridgeInfo.selfState.fields,
        testArgs: {
          fromAddress: fromAddress,
          bridgeTokenId: remoteTokenId,
          tokenChainId: remoteChainId,
          toChainId: remoteChainId,
          toAddress: toAddress,
          tokenAmount: transferAmount,
          arbiterFee: arbiterFee,
          nonce: nonceHex,
          consistencyLevel: consistencyLevel
        },
        inputAssets: [inputAsset],
        existingContracts: fixture.remoteTokenPoolInfo.states()
      })
    }

    await expectAssertionFailed(async () => transferToken(minimalConsistencyLevel - 1))

    const testResult = await transferToken(minimalConsistencyLevel)

    const tokenBridgeForChainState = testResult.contracts.filter(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )[0]
    expect(tokenBridgeForChainState.fields['sendSequence']).toEqual(1)

    // check `totalBridged`
    const remoteTokenPoolState = testResult.contracts.filter(
      (c) => c.contractId === fixture.remoteTokenPoolInfo.contractId
    )[0]
    expect(remoteTokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged - transferAmount)

    const remoteTokenPoolOutput = testResult.txOutputs[0]
    expect(remoteTokenPoolOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPoolInfo.contractId,
        amount: fixture.totalBridged + transferAmount
      }
    ])

    const governanceOutput = testResult.txOutputs[1]
    expect(BigInt(governanceOutput.alphAmount)).toEqual(minimalAlphInContract + messageFee)

    const transfer = new Transfer(transferAmount, remoteTokenId, remoteChainId, toAddress, arbiterFee)
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0]
    expect(event.name).toEqual('WormholeMessage')
    expect(event.fields).toEqual({
      sender: fixture.tokenBridgeInfo.contractId,
      targetChainId: remoteChainId,
      sequence: 0,
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
    const arbiterFee = messageFee
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
          tokenChainId: remoteChainId,
          toChainId: remoteChainId,
          toAddress: toAddress,
          tokenAmount: transferAmount,
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
    const toAddress = randomAssetAddress()
    const transferAmount = oneAlph
    const arbiterFee = messageFee
    const transfer = new Transfer(transferAmount, remoteTokenId, remoteChainId, toRecipientId(toAddress), arbiterFee)
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

    const recipientOutput = testResult.txOutputs.filter((c) => c.address === toAddress)[0]
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
        amount: Number(arbiterFee)
      }
    ])

    // check `totalBridged`
    const remoteTokenPoolState = testResult.contracts.filter(
      (c) => c.contractId === fixture.remoteTokenPoolInfo.contractId
    )[0]
    expect(remoteTokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged + transferAmount)

    const tokenBridgeForChainState = testResult.contracts.filter(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )[0]
    expect(tokenBridgeForChainState.fields['firstNext256']).toEqual(1)

    const contractOutput = testResult.txOutputs.filter((c) => c.address === fixture.remoteTokenPoolInfo.address)[0]
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
    const toAddress = randomAssetAddress()
    const transferAmount = oneAlph
    const arbiterFee = messageFee
    const transfer = new Transfer(
      transferAmount,
      testTokenInfo.contractId,
      CHAIN_ID_ALEPHIUM,
      toRecipientId(toAddress),
      arbiterFee
    )
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

    const tokenBridgeForChainState = testResult.contracts.filter(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )[0]
    expect(tokenBridgeForChainState.fields['start']).toEqual(256)
    expect(tokenBridgeForChainState.fields['firstNext256']).toEqual(0)
    expect(tokenBridgeForChainState.fields['secondNext256']).toEqual(0)

    // the locked assets have not changed
    const tokenPoolState = testResult.contracts.filter((c) => c.address === fixture.localTokenPoolInfo.address)[0]
    const tokenPoolInitAsset = fixture.localTokenPoolInfo.selfState.asset
    expect(tokenPoolState.asset.alphAmount).toEqual(tokenPoolInitAsset.alphAmount)
    expect(tokenPoolState.asset.tokens).toEqual(tokenPoolInitAsset.tokens)

    const unexecutedSequenceContractId = subContractId(fixture.tokenBridgeForChainInfo.contractId, '0000000000000000')
    const unexecutedSequenceState = testResult.contracts.filter((c) => c.contractId === unexecutedSequenceContractId)[0]
    expect(unexecutedSequenceState.fields['begin']).toEqual(0)
    expect(unexecutedSequenceState.fields['sequences']).toEqual(0)

    checkTxCallerBalance(testResult.txOutputs.filter((c) => c.address === payer)[0], 0n)
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
    const arbiterFee = messageFee
    const nonceHex = nonce()
    const inputAsset = alphAndTokenInputAsset(
      fromAddress,
      oneAlph,
      fixture.remoteTokenPoolInfo.contractId,
      transferAmount
    )
    const tokenBridge = fixture.tokenBridgeInfo.contract

    async function transferToken(consistencyLevel: number) {
      return tokenBridge.testPublicMethod('transferToken', {
        address: fixture.tokenBridgeInfo.address,
        initialFields: fixture.tokenBridgeInfo.selfState.fields,
        testArgs: {
          fromAddress: fromAddress,
          bridgeTokenId: remoteTokenId,
          tokenChainId: chainB,
          toChainId: chainC,
          toAddress: toAddress,
          tokenAmount: transferAmount,
          arbiterFee: arbiterFee,
          nonce: nonceHex,
          consistencyLevel: consistencyLevel
        },
        inputAssets: [inputAsset],
        existingContracts: [...fixture.remoteTokenPoolInfo.states(), ...tokenBridgeForChainCInfo.states()]
      })
    }

    const testResult = await transferToken(minimalConsistencyLevel)

    const tokenBridgeForChainBState = testResult.contracts.filter(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )[0]
    expect(tokenBridgeForChainBState.fields['sendSequence']).toEqual(0)

    const tokenBridgeForChainCState = testResult.contracts.filter(
      (c) => c.contractId === tokenBridgeForChainCInfo.contractId
    )[0]
    expect(tokenBridgeForChainCState.fields['sendSequence']).toEqual(1)

    // check `totalBridged`
    const remoteTokenPoolState = testResult.contracts.filter(
      (c) => c.contractId === fixture.remoteTokenPoolInfo.contractId
    )[0]
    expect(remoteTokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged - transferAmount)

    const remoteTokenPoolOutput = testResult.txOutputs[0]
    expect(remoteTokenPoolOutput.tokens).toEqual([
      {
        id: fixture.remoteTokenPoolInfo.contractId,
        amount: fixture.totalBridged + transferAmount
      }
    ])

    const governanceOutput = testResult.txOutputs[1]
    expect(BigInt(governanceOutput.alphAmount)).toEqual(minimalAlphInContract + messageFee)

    const transfer = new Transfer(transferAmount, remoteTokenId, chainB, toAddress, arbiterFee)
    expect(testResult.events.length).toEqual(1)
    const event = testResult.events[0]
    expect(event.name).toEqual('WormholeMessage')
    expect(event.fields).toEqual({
      sender: fixture.tokenBridgeInfo.contractId,
      targetChainId: chainC,
      sequence: 0,
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
    const toAddress = randomAssetAddress()
    const transferAmount = oneAlph
    const arbiterFee = messageFee
    const transfer = new Transfer(transferAmount, remoteTokenId, chainB, toRecipientId(toAddress), arbiterFee)
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

    const recipientOutput = testResult.txOutputs.filter((c) => c.address === toAddress)[0]
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
        amount: Number(arbiterFee)
      }
    ])

    // check `totalBridged`
    const remoteTokenPoolState = testResult.contracts.filter(
      (c) => c.contractId === fixture.remoteTokenPoolInfo.contractId
    )[0]
    expect(remoteTokenPoolState.fields['totalBridged']).toEqual(fixture.totalBridged + transferAmount)

    // check `TokenBridgeForChain` sequences
    const tokenBridgeForChainBState = testResult.contracts.filter(
      (c) => c.contractId === fixture.tokenBridgeForChainInfo.contractId
    )[0]
    expect(tokenBridgeForChainBState.fields['firstNext256']).toEqual(0)

    const tokenBridgeForChainCState = testResult.contracts.filter(
      (c) => c.contractId === tokenBridgeForChainCInfo.contractId
    )[0]
    expect(tokenBridgeForChainCState.fields['firstNext256']).toEqual(1)

    const contractOutput = testResult.txOutputs.filter((c) => c.address === fixture.remoteTokenPoolInfo.address)[0]
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
        zeroPad(path.toString(16), 8)
      )
      const contractInfo = createUnexecutedSequence(
        fixture.tokenBridgeForChainInfo.contractId,
        path * 256,
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
      const prevEncodedState = Buffer.concat([encodeU256(BigInt(receivedSequence) + 1n), encodeU256(sendSequence)])
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
      'registerChain',
      'upgradeContract',
      'destroyUnexecutedSequenceContracts',
      'updateMinimalConsistencyLevel',
      'getRefundAddress',
      'updateRefundAddress',
      'attestToken',
      'createLocalTokenPool',
      'createRemoteTokenPool',
      'updateRemoteTokenPool',
      'transferToken',
      'transferAlph'
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

import { testNodeWallet } from '@alephium/web3-test'
import base58 from 'bs58'
import { getSignedVAA, normalizeTokenId, assert } from './utils'
import { BridgeChain, TransferResult } from './bridge_chain'
import { Sequence } from './sequence'
import {
  addressFromContractId,
  ALPH_TOKEN_ID,
  binToHex,
  ContractState,
  encodeI256,
  Fields,
  groupOfAddress,
  node,
  NodeProvider,
  web3,
  ContractFactory,
  ContractInstance,
  fetchContractState,
  ONE_ALPH,
  DUST_AMOUNT
} from '@alephium/web3'
import {
  attestFromAlph,
  ChainId,
  CHAIN_ID_ALEPHIUM,
  coalesceChainName,
  createRemoteTokenPoolOnAlph,
  getAttestTokenHandlerId,
  getTokenBridgeForChainId,
  getTokenPoolId,
  deserializeAttestTokenVAA,
  transferLocalTokenFromAlph,
  transferRemoteTokenFromAlph,
  deposit as tokenBridgeForChainDeposit,
  deserializeTransferTokenVAA,
  createLocalTokenPoolOnAlph,
  getLocalTokenInfo,
  waitAlphTxConfirmed,
  alephium_contracts,
  redeemOnAlphWithReward
} from '@alephium/wormhole-sdk'
import { TokenInfo } from '@alephium/token-list'
import { randomBytes } from 'ethers/lib/utils'
import { default as alephiumDevnetConfig } from '../../configs/alephium/devnet.json'

export type AlephiumBridgeChain = BridgeChain & {
  groupIndex: number
  nodeProvider: NodeProvider
  bridgeRewardRouter: string
  tokenBridgeContractId: string
  attestWithTokenInfo(tokenId: string, decimals: number, symbol: string, name: string): Promise<Uint8Array>
  getContractState<I extends ContractInstance, F extends Fields>(
    factory: ContractFactory<I, F>,
    address: string
  ): Promise<ContractState<F>>
  getTokenBridgeContractState(): Promise<ContractState<alephium_contracts.TokenBridgeTypes.Fields>>
  deposit(remoteChainId: ChainId, amount: bigint): Promise<void>
}

export async function createAlephium(): Promise<AlephiumBridgeChain> {
  const nodeProvider = new NodeProvider('http://127.0.0.1:22973')
  web3.setCurrentNodeProvider(nodeProvider)
  const nodeWallet = await testNodeWallet()
  const accounts = await nodeWallet.getAccounts()
  const accountAddress = accounts[0].address
  const groupIndex = groupOfAddress(accountAddress)
  const recipientAddress = base58.decode(accountAddress)
  const contracts = alephiumDevnetConfig.contracts
  const tokenBridgeAddress = contracts.nativeTokenBridge
  const tokenBridgeContractId = contracts.tokenBridge
  const testTokenContractId = contracts.testToken
  const governanceAddress = contracts.nativeGovernance
  const bridgeRewardRouterId = contracts.bridgeRewardRouter
  const bridgeRewardRouterAddress = addressFromContractId(bridgeRewardRouterId)
  const sequence = new Sequence()
  const defaultArbiterFee = 0n
  const defaultConfirmations = 0
  const oneAlph = 10n ** 18n

  const getCurrentMessageFee = async (): Promise<bigint> => {
    const governance = alephium_contracts.Governance.at(governanceAddress)
    const contractState = await governance.fetchState()
    return contractState.fields.messageFee
  }

  const currentMessageFee = await getCurrentMessageFee()

  const normalizeTransferAmount = (amount: bigint): bigint => {
    const unit = 10n ** 10n
    return (amount / unit) * unit
  }

  const normalizeAddress = (address: string): Uint8Array => {
    const decoded = base58.decode(address)
    if (decoded.length !== 33) {
      throw new Error(`Invalid address ${address}`)
    }
    return decoded.slice(1)
  }

  const getTransactionFee = async (txId: string): Promise<bigint> => {
    const status = await nodeWallet.nodeProvider.transactions.getTransactionsStatus({ txId: txId })
    // the transaction has been confirmed
    const blockHash = (status as node.Confirmed).blockHash
    const block = await nodeWallet.nodeProvider.blockflow.getBlockflowBlocksBlockHash(blockHash)
    const tx = block.transactions.find((t) => t.unsigned.txId === txId)!
    return BigInt(tx.unsigned.gasPrice) * BigInt(tx.unsigned.gasAmount)
  }

  const getNativeTokenBalanceByAddress = async (address: string): Promise<bigint> => {
    const decoded = base58.decode(address)
    if (decoded[0] === 3) {
      const contractState = await nodeProvider.contracts.getContractsAddressState(address)
      return BigInt(contractState.asset.attoAlphAmount)
    }
    const balance = await nodeWallet.nodeProvider.addresses.getAddressesAddressBalance(address)
    return BigInt(balance.balance)
  }

  const getNativeTokenBalance = async (): Promise<bigint> => {
    return getNativeTokenBalanceByAddress(accountAddress)
  }

  const getTokenBalanceByAddress = async (tokenId: string, address: string): Promise<bigint> => {
    const balance = await nodeWallet.nodeProvider.addresses.getAddressesAddressBalance(address)
    const tokenBalance = balance.tokenBalances?.find((t) => t.id === tokenId)
    return tokenBalance === undefined ? 0n : BigInt(tokenBalance.amount)
  }

  const getTokenBalance = async (tokenId: string): Promise<bigint> => {
    return getTokenBalanceByAddress(tokenId, accountAddress)
  }

  const getWrappedTokenBalance = async (originTokenId: string, tokenChainId: ChainId): Promise<bigint> => {
    return getWrappedTokenBalanceByAddress(originTokenId, tokenChainId, accountAddress)
  }

  const getWrappedTokenBalanceByAddress = async (
    originTokenId: string,
    tokenChainId: ChainId,
    address: string
  ): Promise<bigint> => {
    const remoteTokenId = normalizeTokenId(originTokenId)
    const tokenPoolId = getTokenPoolId(tokenBridgeContractId, tokenChainId, remoteTokenId, groupIndex)
    return getTokenBalanceByAddress(tokenPoolId, address)
  }

  const getLocalLockedTokenBalance = async (tokenId: string): Promise<bigint> => {
    const localTokenPoolId = getTokenPoolId(tokenBridgeContractId, CHAIN_ID_ALEPHIUM, tokenId, groupIndex)
    const contractAddress = addressFromContractId(localTokenPoolId)
    const contractState = await nodeWallet.nodeProvider.contracts.getContractsAddressState(contractAddress)
    if (tokenId === ALPH_TOKEN_ID) {
      const total = BigInt(contractState.asset.attoAlphAmount)
      return total - oneAlph // minus `MinimalAlphInContract`
    }
    const balance = contractState.asset.tokens?.find((t) => t.id === tokenId)?.amount
    return balance === undefined ? 0n : BigInt(balance)
  }

  const getLockedNativeBalance = async (): Promise<bigint> => {
    return getLocalLockedTokenBalance(ALPH_TOKEN_ID)
  }

  const getLockedTokenBalance = async (tokenId: string): Promise<bigint> => {
    return getLocalLockedTokenBalance(tokenId)
  }

  const attestWithTokenInfo = async (
    tokenId: string,
    decimals: number,
    symbol: string,
    name: string
  ): Promise<Uint8Array> => {
    const attestResult = await attestFromAlph(
      nodeWallet,
      tokenBridgeContractId,
      tokenId,
      decimals,
      symbol,
      name,
      accountAddress,
      currentMessageFee,
      defaultConfirmations
    )
    console.log(`attest token from alephium, token id: ${tokenId}, tx id: ${attestResult.txId}`)
    const signedVaa = await getSignedVAA(CHAIN_ID_ALEPHIUM, tokenBridgeContractId, 0, sequence.next())
    const attestTokenHandlerId = getAttestTokenHandlerId(tokenBridgeContractId, CHAIN_ID_ALEPHIUM, groupIndex)
    const createLocalTokenPoolResult = await createLocalTokenPoolOnAlph(
      nodeWallet,
      attestTokenHandlerId,
      tokenId,
      signedVaa,
      accountAddress,
      oneAlph
    )
    await waitAlphTxConfirmed(nodeWallet.nodeProvider, createLocalTokenPoolResult.txId, 1)
    console.log(`create local token pool succeed, token id: ${tokenId}, tx id: ${createLocalTokenPoolResult.txId}`)
    return signedVaa
  }

  const _getLocalTokenInfo = async (tokenId: string): Promise<TokenInfo> => {
    return getLocalTokenInfo(nodeProvider, tokenId)
  }

  const attestToken = async (tokenId: string): Promise<Uint8Array> => {
    throw new Error('not support')
  }

  const createWrapped = async (signedVaa: Uint8Array): Promise<void> => {
    const vaa = deserializeAttestTokenVAA(signedVaa)
    const attestTokenHandlerId = getAttestTokenHandlerId(tokenBridgeContractId, vaa.body.emitterChainId, groupIndex)
    const result = await createRemoteTokenPoolOnAlph(
      nodeWallet,
      attestTokenHandlerId,
      signedVaa,
      accountAddress,
      oneAlph
    )
    await waitAlphTxConfirmed(nodeWallet.nodeProvider, result.txId, 1)
    console.log(`create wrapped token on alph succeed, tx id: ${result.txId}`)
  }

  const getWrappedTokenId = async (tokenChain: ChainId, tokenId: string): Promise<string> => {
    return getTokenPoolId(tokenBridgeContractId, tokenChain, tokenId, groupIndex)
  }

  const transferToken = async (
    tokenId: string,
    amount: bigint,
    toChainId: ChainId,
    toAddress: Uint8Array,
    sequence: number
  ): Promise<TransferResult> => {
    const result = await transferLocalTokenFromAlph(
      nodeWallet,
      tokenBridgeContractId,
      accountAddress,
      tokenId,
      toChainId,
      binToHex(toAddress),
      amount,
      currentMessageFee,
      defaultArbiterFee,
      defaultConfirmations
    )
    console.log(
      `transfer token from alph to ${coalesceChainName(
        toChainId
      )} succeed, token id: ${tokenId}, amount: ${amount}, tx id: ${result.txId}`
    )
    await waitAlphTxConfirmed(nodeWallet.nodeProvider, result.txId, 1)
    const txFee = await getTransactionFee(result.txId)
    const signedVaa = await getSignedVAA(CHAIN_ID_ALEPHIUM, tokenBridgeContractId, toChainId, sequence)
    return { signedVaa, txFee }
  }

  const transferNative = async (
    amount: bigint,
    toChainId: ChainId,
    toAddress: Uint8Array,
    sequence: number
  ): Promise<TransferResult> => {
    const result = await transferLocalTokenFromAlph(
      nodeWallet,
      tokenBridgeContractId,
      accountAddress,
      ALPH_TOKEN_ID,
      toChainId,
      binToHex(toAddress),
      amount,
      currentMessageFee,
      defaultArbiterFee,
      defaultConfirmations
    )
    console.log(`transfer alph to ${coalesceChainName(toChainId)} succeed, amount: ${amount}, tx id: ${result.txId}`)
    await waitAlphTxConfirmed(nodeWallet.nodeProvider, result.txId, 1)
    const txFee = await getTransactionFee(result.txId)
    const signedVaa = await getSignedVAA(CHAIN_ID_ALEPHIUM, tokenBridgeContractId, toChainId, sequence)
    return { signedVaa, txFee }
  }

  const transferWrapped = async (
    originTokenId: string,
    amount: bigint,
    tokenChainId: ChainId,
    toChainId: ChainId,
    toAddress: Uint8Array,
    sequence: number
  ): Promise<TransferResult> => {
    const remoteTokenId = normalizeTokenId(originTokenId)
    const tokenPoolId = getTokenPoolId(tokenBridgeContractId, tokenChainId, remoteTokenId, groupIndex)
    const result = await transferRemoteTokenFromAlph(
      nodeWallet,
      tokenBridgeContractId,
      accountAddress,
      tokenPoolId,
      remoteTokenId,
      tokenChainId,
      toChainId,
      binToHex(toAddress),
      amount,
      currentMessageFee,
      defaultArbiterFee,
      defaultConfirmations
    )
    console.log(
      `transfer wrapped token from alph back to ${coalesceChainName(
        toChainId
      )} succeed, origin token id: ${originTokenId}, amount: ${amount}, tx id: ${result.txId}`
    )
    await waitAlphTxConfirmed(nodeWallet.nodeProvider, result.txId, 1)
    const txFee = await getTransactionFee(result.txId)
    const signedVaa = await getSignedVAA(CHAIN_ID_ALEPHIUM, tokenBridgeContractId, toChainId, sequence)
    return { signedVaa, txFee }
  }

  const redeemToken = async (signedVaa: Uint8Array): Promise<bigint> => {
    const vaa = deserializeTransferTokenVAA(signedVaa)
    const tokenBridgeForChainId = getTokenBridgeForChainId(tokenBridgeContractId, vaa.body.emitterChainId, groupIndex)
    const alphBalanceBeforeRedeem = await getNativeTokenBalance()
    const bridgeRewardRouterAlphBalanceBeforeRedeem = await getNativeTokenBalanceByAddress(bridgeRewardRouterAddress)
    const result = await redeemOnAlphWithReward(nodeWallet, bridgeRewardRouterId, tokenBridgeForChainId, signedVaa)
    await waitAlphTxConfirmed(nodeWallet.nodeProvider, result.txId, 1)
    console.log(`redeem on alph succeed, tx id: ${result.txId}`)
    const alphBalanceAfterRedeem = await getNativeTokenBalance()
    const bridgeRewardRouterAlphBalanceAfterRedeem = await getNativeTokenBalanceByAddress(bridgeRewardRouterAddress)
    const txFee = await getTransactionFee(result.txId)
    const targetAddress = base58.encode(vaa.body.payload.targetAddress)
    const rewardAmount = vaa.body.payload.originChain !== CHAIN_ID_ALEPHIUM ? (ONE_ALPH / 100n) : 0n
    if (targetAddress === accountAddress) {
      const transferAmount =
        vaa.body.payload.originChain === CHAIN_ID_ALEPHIUM && binToHex(vaa.body.payload.originAddress) === ALPH_TOKEN_ID
          ? vaa.body.payload.amount * 10n ** 10n
          : 0n
      assert(alphBalanceBeforeRedeem - txFee + transferAmount === alphBalanceAfterRedeem - rewardAmount)
    } else {
      assert(alphBalanceBeforeRedeem - txFee - DUST_AMOUNT === alphBalanceAfterRedeem)
    }
    assert(bridgeRewardRouterAlphBalanceBeforeRedeem === bridgeRewardRouterAlphBalanceAfterRedeem + rewardAmount)
    return txFee
  }

  const getCurrentGuardianSet = async (): Promise<string[]> => {
    const governance = alephium_contracts.Governance.at(governanceAddress)
    const contractState = await governance.fetchState()
    const encoded = contractState.fields.guardianSets[1]
    const guardianSet = encoded.slice(2) // remove the first byte
    if (guardianSet.length === 0) {
      return []
    }
    if (guardianSet.length % 40 !== 0) {
      throw new Error(`Invalid guardian set: ${guardianSet}`)
    }
    const keySize = guardianSet.length / 40
    const keys: string[] = new Array<string>(keySize)
    for (let i = 0; i < keySize; i++) {
      keys[i] = guardianSet.slice(i * 40, (i + 1) * 40)
    }
    return keys
  }

  const getContractState = async <I extends ContractInstance, F extends Fields>(
    factory: ContractFactory<I, F>,
    address: string
  ): Promise<ContractState<F>> => {
    return await fetchContractState(factory, factory.at(address))
  }

  const getTokenBridgeContractState = async (): Promise<ContractState<alephium_contracts.TokenBridgeTypes.Fields>> => {
    return getContractState(alephium_contracts.TokenBridge, tokenBridgeAddress)
  }

  const deposit = async (remoteChainId: ChainId, amount: bigint): Promise<void> => {
    const tokenBridgeForChainId = getTokenBridgeForChainId(tokenBridgeContractId, remoteChainId, groupIndex)
    const result = await tokenBridgeForChainDeposit(nodeWallet, tokenBridgeForChainId, amount)
    await waitAlphTxConfirmed(nodeProvider, result.txId, 1)
    console.log(`Deposit completed, tx id: ${result.txId}`)
  }

  const genMultiSigAddress = (): Uint8Array => {
    const n = Math.floor(Math.random() * 7) + 3
    const m = Math.floor(Math.random() * n) + 1
    let hex: string = '01' + binToHex(encodeI256(BigInt(n)))
    for (let i = 0; i < n; i += 1) {
      hex += Buffer.from(randomBytes(32)).toString('hex')
    }
    const address = Buffer.from(hex + binToHex(encodeI256(BigInt(m))), 'hex')
    const addressBase58 = base58.encode(address)
    const group = groupOfAddress(addressBase58)
    if (group === groupIndex) {
      return address
    }
    return genMultiSigAddress()
  }

  const getWrappedTokenTotalSupply = async (tokenChainId: ChainId, tokenId: string): Promise<bigint> => {
    const tokenPoolId = getTokenPoolId(tokenBridgeContractId, tokenChainId, tokenId, groupIndex)
    const tokenPoolInstance = alephium_contracts.RemoteTokenPool.at(addressFromContractId(tokenPoolId))
    return (await tokenPoolInstance.methods.getTotalSupply()).returns
  }

  return {
    chainId: CHAIN_ID_ALEPHIUM,
    testTokenId: testTokenContractId,
    wrappedNativeTokenId: ALPH_TOKEN_ID,
    recipientAddress: recipientAddress,
    messageFee: currentMessageFee,
    oneCoin: oneAlph,
    governanceContractAddress: governanceAddress,

    normalizeTransferAmount: normalizeTransferAmount,
    getTransactionFee: getTransactionFee,
    normalizeAddress: normalizeAddress,

    getNativeTokenBalanceByAddress: getNativeTokenBalanceByAddress,
    getNativeTokenBalance: getNativeTokenBalance,
    getTokenBalance: getTokenBalance,
    getWrappedTokenBalance: getWrappedTokenBalance,
    getWrappedTokenBalanceByAddress: getWrappedTokenBalanceByAddress,
    getLockedNativeBalance: getLockedNativeBalance,
    getLockedTokenBalance: getLockedTokenBalance,

    attestToken: attestToken,
    createWrapped: createWrapped,
    getWrappedTokenId: getWrappedTokenId,

    transferToken: transferToken,
    transferNative: transferNative,
    transferWrapped: transferWrapped,

    redeemToken: redeemToken,
    redeemNative: redeemToken,

    getCurrentGuardianSet: getCurrentGuardianSet,
    getCurrentMessageFee: getCurrentMessageFee,

    genMultiSigAddress: genMultiSigAddress,

    groupIndex: groupIndex,
    nodeProvider: nodeProvider,
    bridgeRewardRouter: contracts.bridgeRewardRouter,
    tokenBridgeContractId: tokenBridgeContractId,
    getLocalTokenInfo: _getLocalTokenInfo,
    getWrappedTokenTotalSupply: getWrappedTokenTotalSupply,
    attestWithTokenInfo: attestWithTokenInfo,
    getContractState: getContractState,
    getTokenBridgeContractState: getTokenBridgeContractState,
    deposit: deposit
  }
}

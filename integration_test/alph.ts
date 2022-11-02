import { testNodeWallet } from '@alephium/web3-test'
import base58 from 'bs58'
import { BridgeChain, TransferResult, getSignedVAA, normalizeTokenId, Sequence, waitAlphTxConfirmed } from './utils'
import path from 'path'
import fs from 'fs'
import {
  addressFromContractId,
  binToHex,
  Contract,
  groupOfAddress,
  node,
  NodeProvider,
  Project,
  Val,
  web3
} from '@alephium/web3'
import {
  attestFromAlph,
  attestWrappedAlph,
  ChainId,
  CHAIN_ID_ALEPHIUM,
  coalesceChainName,
  createRemoteTokenPoolOnAlph,
  getAttestTokenHandlerId,
  getTokenBridgeForChainId,
  getTokenPoolId,
  parseVAA,
  redeemOnAlph,
  transferAlph,
  transferLocalTokenFromAlph,
  transferRemoteTokenFromAlph
} from 'alephium-wormhole-sdk'

export async function createAlephium(): Promise<BridgeChain> {
  const nodeProvider = new NodeProvider('http://127.0.0.1:22973')
  web3.setCurrentNodeProvider(nodeProvider)
  const bridgeRootPath = path.join(process.cwd(), '..')
  await Project.build(
    { ignoreUnusedConstantsWarnings: true },
    path.join(bridgeRootPath, 'alephium', 'contracts'),
    path.join(bridgeRootPath, 'alephium', 'artifacts')
  )
  const nodeWallet = await testNodeWallet()
  const accounts = await nodeWallet.getAccounts()
  const accountAddress = accounts[0].address
  const groupIndex = groupOfAddress(accountAddress)
  const recipientAddress = base58.decode(accountAddress).slice(1)
  const deploymentsFile = path.join(process.cwd(), '..', 'alephium', '.deployments.devnet.json')
  const content = fs.readFileSync(deploymentsFile).toString()
  const contracts = JSON.parse(content)['0'].deployContractResults
  const tokenBridgeContractId = contracts.TokenBridge.contractId
  const wrappedAlphContractId = contracts.WrappedAlph.contractId
  const testTokenContractId = contracts.TestToken.contractId
  const governanceAddress = contracts.Governance.contractAddress
  const sequence = new Sequence()
  const defaultMessageFee = 10n ** 14n
  const defaultArbiterFee = 0n
  const defaultConfirmations = 1
  const oneAlph = 10n ** 18n

  const validateToAddress = (toAddress: Uint8Array): string => {
    if (toAddress.length !== 32) {
      throw new Error('Alephium transfer: invalid to address, expect 32 bytes')
    }
    return binToHex(toAddress)
  }

  const normalizeTransferAmount = (amount: bigint): bigint => amount

  const getTransactionFee = async (txId: string): Promise<bigint> => {
    const status = await nodeWallet.nodeProvider.transactions.getTransactionsStatus({ txId: txId })
    // the transaction has been confirmed
    const blockHash = (status as node.Confirmed).blockHash
    const block = await nodeWallet.nodeProvider.blockflow.getBlockflowBlocksBlockHash(blockHash)
    const tx = block.transactions.find((t) => t.unsigned.txId === txId)!
    return BigInt(tx.unsigned.gasPrice) * BigInt(tx.unsigned.gasAmount)
  }

  const getNativeTokenBalance = async (): Promise<bigint> => {
    const balance = await nodeWallet.nodeProvider.addresses.getAddressesAddressBalance(accountAddress)
    return BigInt(balance.balance)
  }

  const getTokenBalance = async (tokenId: string): Promise<bigint> => {
    const balance = await nodeWallet.nodeProvider.addresses.getAddressesAddressBalance(accountAddress)
    const tokenBalance = balance.tokenBalances?.find((t) => t.id === tokenId)
    return tokenBalance === undefined ? 0n : BigInt(tokenBalance.amount)
  }

  const getWrappedTokenBalance = async (originTokenId: string, tokenChainId: ChainId): Promise<bigint> => {
    const remoteTokenId = normalizeTokenId(originTokenId)
    const tokenPoolId = getTokenPoolId(tokenBridgeContractId, tokenChainId, remoteTokenId)
    return getTokenBalance(tokenPoolId)
  }

  const getLocalLockedTokenBalance = async (tokenId: string): Promise<bigint> => {
    const localTokenPoolId = getTokenPoolId(tokenBridgeContractId, CHAIN_ID_ALEPHIUM, tokenId)
    const contractAddress = addressFromContractId(localTokenPoolId)
    const contractState = await nodeWallet.nodeProvider.contracts.getContractsAddressState(contractAddress, {
      group: groupIndex
    })
    const balance = contractState.asset.tokens?.find((t) => t.id === tokenId)?.amount
    return balance === undefined ? 0n : BigInt(balance)
  }

  const getLockedNativeBalance = async (): Promise<bigint> => {
    return getLocalLockedTokenBalance(wrappedAlphContractId)
  }

  const getLockedTokenBalance = async (tokenId: string): Promise<bigint> => {
    return getLocalLockedTokenBalance(tokenId)
  }

  const attestToken = async (tokenId: string): Promise<Uint8Array> => {
    const result =
      tokenId === wrappedAlphContractId
        ? await attestWrappedAlph(nodeWallet, tokenBridgeContractId, tokenId, accountAddress, defaultMessageFee, 1)
        : await attestFromAlph(nodeWallet, tokenBridgeContractId, tokenId, accountAddress, defaultMessageFee, 1)
    console.log(`attest alph token, token id: ${tokenId}, tx id: ${result.txId}`)
    return await getSignedVAA(CHAIN_ID_ALEPHIUM, tokenBridgeContractId, 0, sequence.next())
  }

  const createWrapped = async (signedVaa: Uint8Array): Promise<void> => {
    const vaa = parseVAA(signedVaa)
    const attestTokenHandlerId = getAttestTokenHandlerId(tokenBridgeContractId, vaa.body.emitterChainId)
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
      validateToAddress(toAddress),
      amount,
      defaultMessageFee,
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
    const result = await transferAlph(
      nodeWallet,
      tokenBridgeContractId,
      accountAddress,
      toChainId,
      validateToAddress(toAddress),
      amount,
      defaultArbiterFee,
      defaultConfirmations
    )
    console.log(`transfer walph to ${coalesceChainName(toChainId)} succeed, amount: ${amount}, tx id: ${result.txId}`)
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
    const tokenPoolId = getTokenPoolId(tokenBridgeContractId, tokenChainId, remoteTokenId)
    const result = await transferRemoteTokenFromAlph(
      nodeWallet,
      tokenBridgeContractId,
      accountAddress,
      tokenPoolId,
      remoteTokenId,
      tokenChainId,
      toChainId,
      validateToAddress(toAddress),
      amount,
      defaultMessageFee,
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
    const vaa = parseVAA(signedVaa)
    const tokenBridgeForChainId = getTokenBridgeForChainId(tokenBridgeContractId, vaa.body.emitterChainId)
    const result = await redeemOnAlph(nodeWallet, tokenBridgeForChainId, signedVaa)
    await waitAlphTxConfirmed(nodeWallet.nodeProvider, result.txId, 1)
    console.log(`redeem on alph succeed, tx id: ${result.txId}`)
    return await getTransactionFee(result.txId)
  }

  const getCurrentGuardianSet = async (): Promise<string[]> => {
    const governance = Project.contract('Governance')
    const contractState = await governance.fetchState(governanceAddress, groupIndex)
    const encoded = (contractState.fields['guardianSets'] as Val[])[1] as string
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

  const getCurrentMessageFee = async (): Promise<bigint> => {
    const governance = Project.contract('Governance')
    const contractState = await governance.fetchState(governanceAddress, groupIndex)
    return contractState.fields['messageFee'] as bigint
  }

  return {
    chainId: CHAIN_ID_ALEPHIUM,
    testTokenId: testTokenContractId,
    wrappedNativeTokenId: wrappedAlphContractId,
    recipientAddress: recipientAddress,
    messageFee: defaultMessageFee,
    oneCoin: oneAlph,

    normalizeTransferAmount: normalizeTransferAmount,
    getTransactionFee: getTransactionFee,

    getNativeTokenBalance: getNativeTokenBalance,
    getTokenBalance: getTokenBalance,
    getWrappedTokenBalance: getWrappedTokenBalance,
    getLockedNativeBalance: getLockedNativeBalance,
    getLockedTokenBalance: getLockedTokenBalance,

    attestToken: attestToken,
    createWrapped: createWrapped,

    transferToken: transferToken,
    transferNative: transferNative,
    transferWrapped: transferWrapped,

    redeemToken: redeemToken,
    redeemNative: redeemToken,

    getCurrentGuardianSet: getCurrentGuardianSet,
    getCurrentMessageFee: getCurrentMessageFee
  }
}

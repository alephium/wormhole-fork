import { testNodeWallet } from '@alephium/web3-wallet'
import base58 from 'bs58'
import { BridgeChain, TransferResult, getSignedVAA, normalizeTokenId, Sequence, waitAlphTxConfirmed } from './utils'
import path from 'path'
import fs from 'fs'
import { addressFromContractId, binToHex, groupOfAddress, node, web3 } from '@alephium/web3'
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
} from '@certusone/wormhole-sdk'

export async function createAlephium(): Promise<BridgeChain> {
  web3.setCurrentNodeProvider('http://127.0.0.1:22973')
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
    const status = await nodeWallet.provider.transactions.getTransactionsStatus({ txId: txId })
    // the transaction has been confirmed
    const blockHash = (status as node.Confirmed).blockHash
    const block = await nodeWallet.provider.blockflow.getBlockflowBlocksBlockHash(blockHash)
    const tx = block.transactions.find((t) => t.unsigned.txId === txId)!
    return BigInt(tx.unsigned.gasPrice) * BigInt(tx.unsigned.gasAmount)
  }

  const getNativeTokenBalance = async (): Promise<bigint> => {
    const balance = await nodeWallet.provider.addresses.getAddressesAddressBalance(accountAddress)
    return BigInt(balance.balance)
  }

  const getTokenBalance = async (tokenId: string): Promise<bigint> => {
    const balance = await nodeWallet.provider.addresses.getAddressesAddressBalance(accountAddress)
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
    const contractState = await nodeWallet.provider.contracts.getContractsAddressState(contractAddress, {
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
    const bytecode =
      tokenId === wrappedAlphContractId
        ? attestWrappedAlph(tokenBridgeContractId, tokenId, accountAddress, defaultMessageFee, 1)
        : attestFromAlph(tokenBridgeContractId, tokenId, accountAddress, defaultMessageFee, 1)
    const tokens = tokenId === wrappedAlphContractId ? [] : [{ id: tokenId, amount: 1 }]
    const result = await nodeWallet.signExecuteScriptTx({
      signerAddress: accountAddress,
      bytecode: bytecode,
      submitTx: true,
      tokens: tokens
    })
    console.log(`attest alph token, token id: ${tokenId}, tx id: ${result.txId}`)
    return await getSignedVAA(CHAIN_ID_ALEPHIUM, tokenBridgeContractId, 0, sequence.next())
  }

  const createWrapped = async (signedVaa: Uint8Array): Promise<void> => {
    const vaa = parseVAA(signedVaa)
    const attestTokenHandlerId = getAttestTokenHandlerId(tokenBridgeContractId, vaa.body.emitterChainId)
    const bytecode = createRemoteTokenPoolOnAlph(attestTokenHandlerId, signedVaa, accountAddress, oneAlph)
    const result = await nodeWallet.signExecuteScriptTx({
      signerAddress: accountAddress,
      bytecode: bytecode,
      submitTx: true
    })
    await waitAlphTxConfirmed(nodeWallet.provider, result.txId, 1)
    console.log(`create wrapped token on alph succeed, tx id: ${result.txId}`)
  }

  const transferToken = async (
    tokenId: string,
    amount: bigint,
    toChainId: ChainId,
    toAddress: Uint8Array,
    sequence: number
  ): Promise<TransferResult> => {
    const bytecode = transferLocalTokenFromAlph(
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
    const result = await nodeWallet.signExecuteScriptTx({
      signerAddress: accountAddress,
      bytecode: bytecode,
      submitTx: true,
      tokens: [{ id: tokenId, amount: amount }]
    })
    console.log(
      `transfer token from alph to ${coalesceChainName(
        toChainId
      )} succeed, token id: ${tokenId}, amount: ${amount}, tx id: ${result.txId}`
    )
    await waitAlphTxConfirmed(nodeWallet.provider, result.txId, 1)
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
    const bytecode = transferAlph(
      tokenBridgeContractId,
      accountAddress,
      toChainId,
      validateToAddress(toAddress),
      amount,
      defaultMessageFee,
      defaultArbiterFee,
      defaultConfirmations
    )
    const result = await nodeWallet.signExecuteScriptTx({
      signerAddress: accountAddress,
      bytecode: bytecode,
      submitTx: true,
      attoAlphAmount: (amount + defaultMessageFee).toString()
    })
    console.log(`transfer walph to ${coalesceChainName(toChainId)} succeed, amount: ${amount}, tx id: ${result.txId}`)
    await waitAlphTxConfirmed(nodeWallet.provider, result.txId, 1)
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
    const bytecode = transferRemoteTokenFromAlph(
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
    const result = await nodeWallet.signExecuteScriptTx({
      signerAddress: accountAddress,
      bytecode: bytecode,
      submitTx: true,
      tokens: [{ id: tokenPoolId, amount: amount }],
      attoAlphAmount: (amount + defaultMessageFee).toString()
    })
    console.log(
      `transfer wrapped token from alph back to ${coalesceChainName(
        toChainId
      )} succeed, origin token id: ${originTokenId}, amount: ${amount}, tx id: ${result.txId}`
    )
    await waitAlphTxConfirmed(nodeWallet.provider, result.txId, 1)
    const txFee = await getTransactionFee(result.txId)
    const signedVaa = await getSignedVAA(CHAIN_ID_ALEPHIUM, tokenBridgeContractId, toChainId, sequence)
    return { signedVaa, txFee }
  }

  const redeemToken = async (signedVaa: Uint8Array): Promise<bigint> => {
    const vaa = parseVAA(signedVaa)
    const tokenBridgeForChainId = getTokenBridgeForChainId(tokenBridgeContractId, vaa.body.emitterChainId)
    const bytecode = redeemOnAlph(tokenBridgeForChainId, signedVaa)
    const result = await nodeWallet.signExecuteScriptTx({
      signerAddress: accountAddress,
      bytecode: bytecode,
      submitTx: true
    })
    await waitAlphTxConfirmed(nodeWallet.provider, result.txId, 1)
    console.log(`redeem on alph succeed, tx id: ${result.txId}`)
    return await getTransactionFee(result.txId)
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
    redeemNative: redeemToken
  }
}

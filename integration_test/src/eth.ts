import {
  approveEth,
  attestFromEth,
  Bridge__factory,
  ChainId,
  CHAIN_ID_ETH,
  coalesceChainName,
  createWrappedOnEth,
  ERC20__factory,
  Governance__factory,
  hexToUint8Array,
  MockWETH9__factory,
  redeemOnEth,
  redeemOnEthNative,
  TokenImplementation__factory,
  transferFromEth,
  transferFromEthNative
} from 'alephium-wormhole-sdk'
import { Wallet as ETHWallet, providers } from 'ethers'
import { Sequence } from './sequence'
import { BridgeChain, TransferResult } from './bridge_chain'
import { getSignedVAA, normalizeTokenId } from './utils'
import { default as ethDevnetConfig } from '../../configs/ethereum/devnet.json'

export async function createEth(): Promise<BridgeChain> {
  const contracts = ethDevnetConfig.contracts
  const governanceAddress = contracts.governance
  const tokenBridgeAddress = contracts.tokenBridge
  const tokenBridgeEmitterAddress = ethDevnetConfig.tokenBridgeEmitterAddress
  const wethAddress = contracts.weth
  const testTokenAddress = contracts.testToken
  const wallet = new ETHWallet(ethDevnetConfig.privateKey, new providers.JsonRpcProvider('http://127.0.0.1:8545'))
  const recipientAddress = hexToUint8Array(wallet.address.slice(2))
  const sequence = new Sequence()

  const getCurrentMessageFee = async (): Promise<bigint> => {
    const governance = Governance__factory.connect(governanceAddress, wallet)
    const messageFee = await governance.messageFee()
    return messageFee.toBigInt()
  }

  const currentMessageFee = await getCurrentMessageFee()

  const ethTxOptions = {
    gasLimit: 5000000,
    gasPrice: 1000000,
    value: currentMessageFee
  }

  const validateEthTokenAddress = (tokenId: string) => {
    const hasPrefix = tokenId.startsWith('0x') || tokenId.startsWith('0X')
    if (!hasPrefix || tokenId.length !== 42) {
      throw new Error(`Eth transfer: invalid eth token address: ${tokenId}`)
    }
  }

  const normalizeTransferAmount = (amount: bigint): bigint => {
    const unit = 10n ** 10n
    return (amount / unit) * unit
  }

  const normalizeAddress = (address: string): Uint8Array => {
    if (address.startsWith('0x') || address.startsWith('0X')) {
      return Buffer.from(address.slice(2).padStart(64, '0'), 'hex')
    }
    return Buffer.from(address.padStart(64, '0'), 'hex')
  }

  const getTransactionFee = async (txId: string): Promise<bigint> => {
    const receipt = await wallet.provider.getTransactionReceipt(txId)
    const tx = await wallet.provider.getTransaction(txId)
    return tx.gasPrice!.mul(receipt.gasUsed).toBigInt()
  }

  const getNativeTokenBalanceByAddress = async (address: string): Promise<bigint> => {
    const balance = await wallet.provider.getBalance(address)
    return balance.toBigInt()
  }

  const getNativeTokenBalance = async (): Promise<bigint> => {
    return getNativeTokenBalanceByAddress(wallet.address)
  }

  const getWrappedToken = async (originTokenId: string, tokenChainId: ChainId): Promise<string> => {
    const remoteTokenId = normalizeTokenId(originTokenId)
    const tokenBridge = Bridge__factory.connect(tokenBridgeAddress, wallet)
    return await tokenBridge.wrappedAsset(tokenChainId, hexToUint8Array(remoteTokenId))
  }

  const getTokenBalanceOf = async (tokenId: string, address: string): Promise<bigint> => {
    const erc20Token = ERC20__factory.connect(tokenId, wallet)
    const balance = await erc20Token.balanceOf(address)
    return balance.toBigInt()
  }

  const getWrappedTokenBalanceByAddress = async (
    originTokenId: string,
    tokenChainId: ChainId,
    address: string
  ): Promise<bigint> => {
    const wrappedToken = await getWrappedToken(originTokenId, tokenChainId)
    const token = TokenImplementation__factory.connect(wrappedToken, wallet)
    const balance = await token.balanceOf(address)
    return balance.toBigInt()
  }

  const getTokenBalance = async (tokenId: string): Promise<bigint> => {
    return await getTokenBalanceOf(tokenId, wallet.address)
  }

  const getWrappedTokenBalance = async (originTokenId: string, tokenChainId: ChainId): Promise<bigint> => {
    return getWrappedTokenBalanceByAddress(originTokenId, tokenChainId, wallet.address)
  }

  const getLockedNativeBalance = async (): Promise<bigint> => {
    const weth = MockWETH9__factory.connect(wethAddress, wallet)
    const balance = await weth.balanceOf(tokenBridgeAddress)
    return balance.toBigInt()
  }

  const getLockedTokenBalance = async (tokenId: string): Promise<bigint> => {
    return getTokenBalanceOf(tokenId, tokenBridgeAddress)
  }

  const attestToken = async (tokenId: string): Promise<Uint8Array> => {
    validateEthTokenAddress(tokenId)
    const ethReceipt = await attestFromEth(tokenBridgeAddress, wallet, tokenId, ethTxOptions)
    console.log(`attest token, token address: ${tokenId}, tx id: ${ethReceipt.transactionHash}`)
    return await getSignedVAA(CHAIN_ID_ETH, tokenBridgeEmitterAddress, 0, sequence.next())
  }

  const createWrapped = async (signedVaa: Uint8Array): Promise<void> => {
    const ethReceipt = await createWrappedOnEth(tokenBridgeAddress, wallet, signedVaa)
    console.log(`create wrapped succeed, tx id: ${ethReceipt.transactionHash}`)
  }

  const transferToken = async (
    tokenId: string,
    amount: bigint,
    toChainId: ChainId,
    toAddress: Uint8Array,
    sequence: number
  ): Promise<TransferResult> => {
    validateEthTokenAddress(tokenId)
    const approveReceipt = await approveEth(tokenBridgeAddress, tokenId, wallet, amount)
    const transferReceipt = await transferFromEth(
      tokenBridgeAddress,
      wallet,
      tokenId,
      amount,
      toChainId,
      toAddress,
      undefined,
      ethTxOptions
    )
    console.log(
      `transfer eth token to ${coalesceChainName(
        toChainId
      )} succeed, token address: ${tokenId}, amount: ${amount}, tx id: ${transferReceipt.transactionHash}`
    )
    const approveTxFee = await getTransactionFee(approveReceipt.transactionHash)
    const transferTxFee = await getTransactionFee(transferReceipt.transactionHash)
    const txFee = approveTxFee + transferTxFee
    const signedVaa = await getSignedVAA(CHAIN_ID_ETH, tokenBridgeEmitterAddress, toChainId, sequence)
    return { signedVaa, txFee }
  }

  const transferNative = async (
    amount: bigint,
    toChainId: ChainId,
    toAddress: Uint8Array,
    sequence: number
  ): Promise<TransferResult> => {
    const approveReceipt = await approveEth(tokenBridgeAddress, wethAddress, wallet, amount)
    const transferReceipt = await transferFromEthNative(
      tokenBridgeAddress,
      wallet,
      amount,
      toChainId,
      toAddress,
      undefined,
      ethTxOptions
    )
    console.log(
      `transfer weth to ${coalesceChainName(toChainId)} succeed, amount: ${amount}, tx id: ${
        transferReceipt.transactionHash
      }`
    )
    const approveTxFee = await getTransactionFee(approveReceipt.transactionHash)
    const transferTxFee = await getTransactionFee(transferReceipt.transactionHash)
    const txFee = approveTxFee + transferTxFee
    const signedVaa = await getSignedVAA(CHAIN_ID_ETH, tokenBridgeEmitterAddress, toChainId, sequence)
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
    const wrappedToken = await getWrappedToken(originTokenId, tokenChainId)
    const approveReceipt = await approveEth(tokenBridgeAddress, wrappedToken, wallet, amount)
    const transferReceipt = await transferFromEth(
      tokenBridgeAddress,
      wallet,
      wrappedToken,
      amount,
      toChainId,
      toAddress,
      undefined,
      ethTxOptions
    )
    console.log(
      `transfer wrapped token from eth back to ${coalesceChainName(
        toChainId
      )} succeed, origin token id: ${originTokenId}, amount: ${amount}, tx id: ${transferReceipt.transactionHash}`
    )
    const approveTxFee = await getTransactionFee(approveReceipt.transactionHash)
    const transferTxFee = await getTransactionFee(transferReceipt.transactionHash)
    const txFee = approveTxFee + transferTxFee
    const signedVaa = await getSignedVAA(CHAIN_ID_ETH, tokenBridgeEmitterAddress, toChainId, sequence)
    return { signedVaa, txFee }
  }

  const redeemToken = async (signedVaa: Uint8Array): Promise<bigint> => {
    const receipt = await redeemOnEth(tokenBridgeAddress, wallet, signedVaa)
    console.log(`redeem on eth succeed, tx id: ${receipt.transactionHash}`)
    return await getTransactionFee(receipt.transactionHash)
  }

  const redeemNative = async (signedVaa: Uint8Array): Promise<bigint> => {
    const receipt = await redeemOnEthNative(tokenBridgeAddress, wallet, signedVaa)
    console.log(`redeem on eth succeed, tx id: ${receipt.transactionHash}`)
    return await getTransactionFee(receipt.transactionHash)
  }

  const getCurrentGuardianSet = async (): Promise<string[]> => {
    const governance = Governance__factory.connect(governanceAddress, wallet)
    const guardianSetIndex = await governance.getCurrentGuardianSetIndex()
    const result = await governance.getGuardianSet(guardianSetIndex)
    return result[0]
  }

  const genMultiSigAddress = (): Uint8Array => {
    throw new Error('Not supported')
  }

  return {
    chainId: CHAIN_ID_ETH,
    testTokenId: testTokenAddress,
    wrappedNativeTokenId: wethAddress,
    recipientAddress: recipientAddress,
    messageFee: currentMessageFee,
    oneCoin: 10n ** 18n,
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

    transferToken: transferToken,
    transferNative: transferNative,
    transferWrapped: transferWrapped,

    redeemToken: redeemToken,
    redeemNative: redeemNative,

    getCurrentGuardianSet: getCurrentGuardianSet,
    getCurrentMessageFee: getCurrentMessageFee,

    genMultiSigAddress: genMultiSigAddress
  }
}

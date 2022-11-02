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
  transferFromEthNative,
  zeroPad
} from 'alephium-wormhole-sdk'
import { Wallet as ETHWallet, providers } from 'ethers'
import { Sequence } from './sequence'
import { BridgeChain, TransferResult } from './bridge_chain'
import { getSignedVAA, normalizeTokenId } from './utils'

export async function createEth(): Promise<BridgeChain> {
  // Eth contract addresses are deterministic on devnet
  const governanceAddress = '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550'
  const tokenBridgeAddress = '0x0290FB167208Af455bB137780163b7B7a9a10C16'
  const tokenBridgeEmitterAddress = zeroPad(tokenBridgeAddress.slice(2), 32)
  const wethAddress = '0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E'
  const testTokenAddress = '0x2D8BE6BF0baA74e0A907016679CaE9190e80dD0A'
  const wallet = new ETHWallet(
    '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
    new providers.JsonRpcProvider('http://127.0.0.1:8545')
  )
  const recipientAddress = hexToUint8Array(zeroPad(wallet.address.slice(2), 32))
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

  const validateToAddress = (toAddress: Uint8Array): Uint8Array => {
    if (toAddress.length !== 32) {
      throw new Error('Eth transfer: invalid to address, expect 32 bytes')
    }
    return toAddress
  }

  const normalizeTransferAmount = (amount: bigint): bigint => {
    const unit = 10n ** 10n
    return (amount / unit) * unit
  }

  const getTransactionFee = async (txId: string): Promise<bigint> => {
    const receipt = await wallet.provider.getTransactionReceipt(txId)
    const tx = await wallet.provider.getTransaction(txId)
    return tx.gasPrice!.mul(receipt.gasUsed).toBigInt()
  }

  const getNativeTokenBalance = async (): Promise<bigint> => {
    const balanace = await wallet.getBalance()
    return balanace.toBigInt()
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

  const getWrappedTokenBalanceOf = async (
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
    return getWrappedTokenBalanceOf(originTokenId, tokenChainId, wallet.address)
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
      validateToAddress(toAddress),
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
      validateToAddress(toAddress),
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
      validateToAddress(toAddress),
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

  return {
    chainId: CHAIN_ID_ETH,
    testTokenId: testTokenAddress,
    wrappedNativeTokenId: wethAddress,
    recipientAddress: recipientAddress,
    messageFee: currentMessageFee,
    oneCoin: 10n ** 18n,

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
    redeemNative: redeemNative,

    getCurrentGuardianSet: getCurrentGuardianSet,
    getCurrentMessageFee: getCurrentMessageFee
  }
}

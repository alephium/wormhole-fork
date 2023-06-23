import {
  approveEth,
  attestFromEth,
  ethers_contracts,
  ChainId,
  coalesceChainName,
  createWrappedOnEth,
  hexToUint8Array,
  redeemOnEth,
  redeemOnEthNative,
  transferFromEth,
  transferFromEthNative
} from '@alephium/wormhole-sdk'
import { Wallet as ETHWallet, providers } from 'ethers'
import { Sequence } from './sequence'
import { BridgeChain, TransferResult } from './bridge_chain'
import { getSignedVAA, normalizeTokenId } from './utils'
import {
  Bridge__factory,
  ERC20__factory,
  TokenImplementation__factory
} from '@alephium/wormhole-sdk/lib/cjs/ethers-contracts'
import { TokenInfo } from '@alephium/token-list'

export interface EvmChainConfig {
  chainId: ChainId
  contracts: {
    governance: string
    tokenBridge: string
    wrappedNative: string
    testToken: string
  }
  privateKey: string
  tokenBridgeEmitterAddress: string
  nodeUrl: string
}

export async function createEvmChain(config: EvmChainConfig): Promise<BridgeChain> {
  const chainName: string = coalesceChainName(config.chainId)
  const contracts = config.contracts
  const governanceAddress = contracts.governance
  const tokenBridgeAddress = contracts.tokenBridge
  const tokenBridgeEmitterAddress = config.tokenBridgeEmitterAddress
  const wrappedNativeAddress = contracts.wrappedNative
  const testTokenAddress = contracts.testToken
  const wallet = new ETHWallet(config.privateKey, new providers.JsonRpcProvider(config.nodeUrl))
  const recipientAddress = hexToUint8Array(wallet.address.slice(2))
  const sequence = new Sequence()

  const getCurrentMessageFee = async (): Promise<bigint> => {
    const governance = ethers_contracts.Governance__factory.connect(governanceAddress, wallet)
    const messageFee = await governance.messageFee()
    return messageFee.toBigInt()
  }

  const currentMessageFee = await getCurrentMessageFee()

  const evmTxOptions = {
    gasLimit: 5000000,
    gasPrice: 1000000,
    value: currentMessageFee
  }

  const validateEvmTokenAddress = (tokenId: string) => {
    const hasPrefix = tokenId.startsWith('0x') || tokenId.startsWith('0X')
    if (!hasPrefix || tokenId.length !== 42) {
      throw new Error(`Evm transfer: invalid evm token address: ${tokenId}`)
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
    const tokenBridge = ethers_contracts.Bridge__factory.connect(tokenBridgeAddress, wallet)
    return await tokenBridge.wrappedAsset(tokenChainId, hexToUint8Array(remoteTokenId))
  }

  const getTokenBalanceOf = async (tokenId: string, address: string): Promise<bigint> => {
    const erc20Token = ethers_contracts.ERC20__factory.connect(tokenId, wallet)
    const balance = await erc20Token.balanceOf(address)
    return balance.toBigInt()
  }

  const getWrappedTokenBalanceByAddress = async (
    originTokenId: string,
    tokenChainId: ChainId,
    address: string
  ): Promise<bigint> => {
    const wrappedToken = await getWrappedToken(originTokenId, tokenChainId)
    const token = ethers_contracts.TokenImplementation__factory.connect(wrappedToken, wallet)
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
    const wrappedNative = ethers_contracts.MockWETH9__factory.connect(wrappedNativeAddress, wallet)
    const balance = await wrappedNative.balanceOf(tokenBridgeAddress)
    return balance.toBigInt()
  }

  const getLockedTokenBalance = async (tokenId: string): Promise<bigint> => {
    return getTokenBalanceOf(tokenId, tokenBridgeAddress)
  }

  const attestToken = async (tokenId: string): Promise<Uint8Array> => {
    validateEvmTokenAddress(tokenId)
    const receipt = await attestFromEth(tokenBridgeAddress, wallet, tokenId, evmTxOptions)
    console.log(`attest token, token address: ${tokenId}, tx id: ${receipt.transactionHash}`)
    return await getSignedVAA(config.chainId, tokenBridgeEmitterAddress, 0, sequence.next())
  }

  const createWrapped = async (signedVaa: Uint8Array): Promise<void> => {
    const receipt = await createWrappedOnEth(tokenBridgeAddress, wallet, signedVaa)
    console.log(`create wrapped succeed, tx id: ${receipt.transactionHash}`)
  }

  const getWrappedTokenId = async (tokenChain: ChainId, tokenId: string): Promise<string> => {
    const bridge = Bridge__factory.connect(tokenBridgeAddress, wallet)
    return bridge.wrappedAsset(tokenChain, Buffer.from(tokenId, 'hex'))
  }

  const transferToken = async (
    tokenId: string,
    amount: bigint,
    toChainId: ChainId,
    toAddress: Uint8Array,
    sequence: number
  ): Promise<TransferResult> => {
    validateEvmTokenAddress(tokenId)
    const approveReceipt = await approveEth(tokenBridgeAddress, tokenId, wallet, amount)
    const transferReceipt = await transferFromEth(
      tokenBridgeAddress,
      wallet,
      tokenId,
      amount,
      toChainId,
      toAddress,
      undefined,
      evmTxOptions
    )
    console.log(
      `transfer token from ${chainName} to ${coalesceChainName(
        toChainId
      )} succeed, token address: ${tokenId}, amount: ${amount}, tx id: ${transferReceipt.transactionHash}`
    )
    const approveTxFee = await getTransactionFee(approveReceipt.transactionHash)
    const transferTxFee = await getTransactionFee(transferReceipt.transactionHash)
    const txFee = approveTxFee + transferTxFee
    const signedVaa = await getSignedVAA(config.chainId, tokenBridgeEmitterAddress, toChainId, sequence)
    return { signedVaa, txFee }
  }

  const transferNative = async (
    amount: bigint,
    toChainId: ChainId,
    toAddress: Uint8Array,
    sequence: number
  ): Promise<TransferResult> => {
    const transferAmount = currentMessageFee + amount
    const transferReceipt = await transferFromEthNative(
      tokenBridgeAddress,
      wallet,
      transferAmount,
      toChainId,
      toAddress,
      undefined,
      {
        ...evmTxOptions,
        value: transferAmount
      }
    )
    console.log(
      `transfer wrapped native token from ${chainName} to ${coalesceChainName(
        toChainId
      )} succeed, amount: ${amount}, tx id: ${transferReceipt.transactionHash}`
    )
    const txFee = await getTransactionFee(transferReceipt.transactionHash)
    const signedVaa = await getSignedVAA(config.chainId, tokenBridgeEmitterAddress, toChainId, sequence)
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
      evmTxOptions
    )
    console.log(
      `transfer wrapped token from ${chainName} back to ${coalesceChainName(
        toChainId
      )} succeed, origin token id: ${originTokenId}, amount: ${amount}, tx id: ${transferReceipt.transactionHash}`
    )
    const approveTxFee = await getTransactionFee(approveReceipt.transactionHash)
    const transferTxFee = await getTransactionFee(transferReceipt.transactionHash)
    const txFee = approveTxFee + transferTxFee
    const signedVaa = await getSignedVAA(config.chainId, tokenBridgeEmitterAddress, toChainId, sequence)
    return { signedVaa, txFee }
  }

  const redeemToken = async (signedVaa: Uint8Array): Promise<bigint> => {
    const receipt = await redeemOnEth(tokenBridgeAddress, wallet, signedVaa)
    console.log(`redeem on ${chainName} succeed, tx id: ${receipt.transactionHash}`)
    return await getTransactionFee(receipt.transactionHash)
  }

  const redeemNative = async (signedVaa: Uint8Array): Promise<bigint> => {
    const receipt = await redeemOnEthNative(tokenBridgeAddress, wallet, signedVaa)
    console.log(`redeem on ${chainName} succeed, tx id: ${receipt.transactionHash}`)
    return await getTransactionFee(receipt.transactionHash)
  }

  const getCurrentGuardianSet = async (): Promise<string[]> => {
    const governance = ethers_contracts.Governance__factory.connect(governanceAddress, wallet)
    const guardianSetIndex = await governance.getCurrentGuardianSetIndex()
    const result = await governance.getGuardianSet(guardianSetIndex)
    return result[0]
  }

  const genMultiSigAddress = (): Uint8Array => {
    throw new Error('Not supported')
  }

  const getLocalTokenInfo = async (tokenAddress: string): Promise<TokenInfo> => {
    const result = ERC20__factory.connect(tokenAddress, wallet)
    const symbol = await result.symbol()
    const name = await result.name()
    const decimals = await result.decimals()
    return { id: normalizeTokenId(tokenAddress), symbol, name, decimals }
  }

  const getWrappedTokenTotalSupply = async (tokenChainId: ChainId, tokenId: string): Promise<bigint> => {
    const tokenBridge = ethers_contracts.BridgeImplementation__factory.connect(tokenBridgeAddress, wallet)
    const wrappedTokenId = await tokenBridge.wrappedAsset(tokenChainId, '0x' + normalizeTokenId(tokenId))
    const wrappedToken = TokenImplementation__factory.connect(wrappedTokenId, wallet)
    return (await wrappedToken.totalSupply()).toBigInt()
  }

  return {
    chainId: config.chainId,
    testTokenId: testTokenAddress,
    wrappedNativeTokenId: wrappedNativeAddress,
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
    getWrappedTokenTotalSupply: getWrappedTokenTotalSupply,

    attestToken: attestToken,
    createWrapped: createWrapped,
    getWrappedTokenId: getWrappedTokenId,
    getLocalTokenInfo: getLocalTokenInfo,

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

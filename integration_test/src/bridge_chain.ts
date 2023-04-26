import { TokenInfo } from '@alephium/token-list'
import { ChainId } from 'alephium-wormhole-sdk'

export type TransferResult = { signedVaa: Uint8Array; txFee: bigint }

export interface BridgeChain {
  chainId: ChainId
  testTokenId: string
  wrappedNativeTokenId: string
  recipientAddress: Uint8Array
  messageFee: bigint
  oneCoin: bigint
  governanceContractAddress: string

  getTransactionFee(txId: string): Promise<bigint>
  normalizeTransferAmount(amount: bigint): bigint
  normalizeAddress(address: string): Uint8Array

  getNativeTokenBalanceByAddress(address: string): Promise<bigint>
  getNativeTokenBalance(): Promise<bigint>
  getTokenBalance(tokenId: string): Promise<bigint>
  getWrappedTokenBalance(originTokenId: string, tokenChainId: ChainId): Promise<bigint>
  getWrappedTokenBalanceByAddress(originTokenId: string, tokenChainId: ChainId, address: string): Promise<bigint>
  getLockedNativeBalance(): Promise<bigint>
  getLockedTokenBalance(tokenId: string): Promise<bigint>

  attestToken(tokenId: string): Promise<Uint8Array>
  createWrapped(signedVaa: Uint8Array): Promise<void>
  getWrappedTokenId(tokenChain: ChainId, tokenId: string): Promise<string>
  getLocalTokenInfo(tokenId: string): Promise<TokenInfo>

  transferToken(
    tokenId: string,
    amount: bigint,
    toChainId: ChainId,
    toAddress: Uint8Array,
    sequence: number
  ): Promise<TransferResult>
  transferNative(amount: bigint, toChainId: ChainId, toAddress: Uint8Array, sequence: number): Promise<TransferResult>
  transferWrapped(
    originTokenId: string,
    amount: bigint,
    tokenChainId: ChainId,
    toChainId: ChainId,
    toAddress: Uint8Array,
    sequence: number
  ): Promise<TransferResult>

  redeemToken(signedVaa: Uint8Array): Promise<bigint>
  redeemNative(signedVaa: Uint8Array): Promise<bigint>

  getCurrentGuardianSet(): Promise<string[]>
  getCurrentMessageFee(): Promise<bigint>

  genMultiSigAddress(): Uint8Array
}

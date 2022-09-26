import { NodeProvider, node } from '@alephium/web3'
import { ChainId, getSignedVAAWithRetry, zeroPad } from '@certusone/wormhole-sdk'
import { NodeHttpTransport } from '@improbable-eng/grpc-web-node-http-transport'

export type TransferResult = { signedVaa: Uint8Array; txFee: bigint }

export interface BridgeChain {
  chainId: ChainId
  testTokenId: string
  wrappedNativeTokenId: string
  recipientAddress: Uint8Array
  messageFee: bigint
  oneCoin: bigint

  getTransactionFee(txId: string): Promise<bigint>
  normalizeTransferAmount(amount: bigint): bigint

  getNativeTokenBalance(): Promise<bigint>
  getTokenBalance(tokenId: string): Promise<bigint>
  getWrappedTokenBalance(originTokenId: string, tokenChainId: ChainId): Promise<bigint>
  getLockedNativeBalance(): Promise<bigint>
  getLockedTokenBalance(tokenId: string): Promise<bigint>

  attestToken(tokenId: string): Promise<Uint8Array>
  createWrapped(signedVaa: Uint8Array): Promise<void>

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
}

export class Sequence {
  private seq: number

  constructor() {
    this.seq = 0
  }

  next(): number {
    const current = this.seq
    this.seq += 1
    return current
  }
}

function assert(condition: boolean) {
  if (!condition) {
    console.trace('transfer error')
    process.exit(-1)
  }
}

export class TransferTokenTest {
  fromChain: BridgeChain
  toChain: BridgeChain
  private sequence: Sequence

  constructor(from: BridgeChain, to: BridgeChain) {
    this.fromChain = from
    this.toChain = to
    this.sequence = new Sequence()
  }

  async transferTestToken(amount: bigint): Promise<void> {
    const tokenId = this.fromChain.testTokenId
    const balanceBeforeTransferOnEmitterChain = await this.fromChain.getTokenBalance(tokenId)
    const balanceBeforeTransferOnTargetChain = await this.toChain.getWrappedTokenBalance(
      tokenId,
      this.fromChain.chainId
    )
    const lockedBalanceBeforeTransfer = await this.fromChain.getLockedTokenBalance(tokenId)
    const transferResult = await this.fromChain.transferToken(
      tokenId,
      amount,
      this.toChain.chainId,
      this.toChain.recipientAddress,
      this.sequence.next()
    )
    await this.toChain.redeemToken(transferResult.signedVaa)

    const balanceAfterTransferOnEmitterChain = await this.fromChain.getTokenBalance(tokenId)
    const lockedBalanceAfterTransfer = await this.fromChain.getLockedTokenBalance(tokenId)
    const balanceAfterTransferOnTargetChain = await this.toChain.getWrappedTokenBalance(tokenId, this.fromChain.chainId)

    assert(amount + balanceAfterTransferOnEmitterChain === balanceBeforeTransferOnEmitterChain)
    assert(amount + lockedBalanceBeforeTransfer === lockedBalanceAfterTransfer)
    assert(amount + balanceBeforeTransferOnTargetChain === balanceAfterTransferOnTargetChain)
  }

  async transferNativeToken(amount: bigint): Promise<void> {
    const lockedBalanceBeforeTransfer = await this.fromChain.getLockedNativeBalance()
    const balanceBeforeTransferOnEmitterChain = await this.fromChain.getNativeTokenBalance()
    const balanceBeforeTransferOnTargetChain = await this.toChain.getWrappedTokenBalance(
      this.fromChain.wrappedNativeTokenId,
      this.fromChain.chainId
    )
    const transferResult = await this.fromChain.transferNative(
      amount,
      this.toChain.chainId,
      this.toChain.recipientAddress,
      this.sequence.next()
    )
    await this.toChain.redeemToken(transferResult.signedVaa)
    const lockedBalanceAfterTransfer = await this.fromChain.getLockedNativeBalance()
    const balanceAfterTransferOnEmitterChain = await this.fromChain.getNativeTokenBalance()
    const balanceAfterTransferOnTargetChain = await this.toChain.getWrappedTokenBalance(
      this.fromChain.wrappedNativeTokenId,
      this.fromChain.chainId
    )

    const realTransferAmount = amount - this.fromChain.messageFee
    assert(amount + transferResult.txFee + balanceAfterTransferOnEmitterChain === balanceBeforeTransferOnEmitterChain)
    assert(realTransferAmount + lockedBalanceBeforeTransfer === lockedBalanceAfterTransfer)
    assert(realTransferAmount + balanceBeforeTransferOnTargetChain === balanceAfterTransferOnTargetChain)
  }

  async transferWrappedTestToken(amount: bigint): Promise<void> {
    const balanceBeforeTransferOnEmitterChain = await this.fromChain.getWrappedTokenBalance(
      this.toChain.testTokenId,
      this.toChain.chainId
    )
    const balanceBeforeTransferOnTargetChain = await this.toChain.getTokenBalance(this.toChain.testTokenId)
    const transferResult = await this.fromChain.transferWrapped(
      this.toChain.testTokenId,
      amount,
      this.toChain.chainId,
      this.toChain.chainId,
      this.toChain.recipientAddress,
      this.sequence.next()
    )
    await this.toChain.redeemToken(transferResult.signedVaa)
    const balanceAfterTransferOnEmitterChain = await this.fromChain.getWrappedTokenBalance(
      this.toChain.testTokenId,
      this.toChain.chainId
    )
    const balanceAfterTransferOnTargetChain = await this.toChain.getTokenBalance(this.toChain.testTokenId)
    assert(amount + balanceAfterTransferOnEmitterChain === balanceBeforeTransferOnEmitterChain)
    assert(amount + balanceBeforeTransferOnTargetChain === balanceAfterTransferOnTargetChain)
  }

  async transferWrappedNativeToken(amount: bigint): Promise<void> {
    const balanceBeforeTransferOnEmitterChain = await this.fromChain.getWrappedTokenBalance(
      this.toChain.wrappedNativeTokenId,
      this.toChain.chainId
    )
    const balanceBeforeTransferOnTargetChain = await this.toChain.getNativeTokenBalance()
    const transferResult = await this.fromChain.transferWrapped(
      this.toChain.wrappedNativeTokenId,
      amount,
      this.toChain.chainId,
      this.toChain.chainId,
      this.toChain.recipientAddress,
      this.sequence.next()
    )
    const txFee = await this.toChain.redeemNative(transferResult.signedVaa)
    const balanceAfterTransferOnEmitterChain = await this.fromChain.getWrappedTokenBalance(
      this.toChain.wrappedNativeTokenId,
      this.toChain.chainId
    )
    const balanceAfterTransferOnTargetChain = await this.toChain.getNativeTokenBalance()

    assert(amount + balanceBeforeTransferOnTargetChain - txFee === balanceAfterTransferOnTargetChain)
    assert(amount + balanceAfterTransferOnEmitterChain === balanceBeforeTransferOnEmitterChain)
  }
}

const GuardianHosts: string[] = ['http://127.0.0.1:7071']
export async function getSignedVAA(
  emitterChainId: ChainId,
  emitterAddress: string,
  targetChainId: ChainId,
  sequence: number
): Promise<Uint8Array> {
  const response = await getSignedVAAWithRetry(
    GuardianHosts,
    emitterChainId,
    emitterAddress,
    targetChainId,
    sequence.toString(),
    { transport: NodeHttpTransport() },
    1000,
    30
  )
  return response.vaaBytes
}

export function normalizeTokenId(tokenId: string): string {
  if (tokenId.length === 64) {
    return tokenId
  }
  if (tokenId.startsWith('0x') || tokenId.startsWith('0X')) {
    // ETH token address
    return zeroPad(tokenId.slice(2), 32)
  }
  if (tokenId.length === 40) {
    return zeroPad(tokenId, 32)
  }
  throw new Error(`invalid token id: ${tokenId}`)
}

function isConfirmed(txStatus: node.TxStatus): txStatus is node.Confirmed {
  return txStatus.type === 'Confirmed'
}

// TODO: add this to SDK
export async function waitAlphTxConfirmed(
  provider: NodeProvider,
  txId: string,
  confirmations: number
): Promise<node.Confirmed> {
  const status = await provider.transactions.getTransactionsStatus({ txId: txId })
  if (isConfirmed(status) && status.chainConfirmations >= confirmations) {
    return status
  }
  await new Promise((r) => setTimeout(r, 1000))
  return waitAlphTxConfirmed(provider, txId, confirmations)
}

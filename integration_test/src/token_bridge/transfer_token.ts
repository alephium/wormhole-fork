import { Sequence } from '../sequence'
import { BridgeChain } from '../bridge_chain'
import { assert, randomBigInt } from '../utils'
import * as base58 from 'bs58'
import { DUST_AMOUNT, ONE_ALPH } from '@alephium/web3'

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

    assert(
      amount + this.fromChain.messageFee + transferResult.txFee + balanceAfterTransferOnEmitterChain ===
        balanceBeforeTransferOnEmitterChain
    )
    assert(amount + lockedBalanceBeforeTransfer === lockedBalanceAfterTransfer)
    assert(amount + balanceBeforeTransferOnTargetChain === balanceAfterTransferOnTargetChain)
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

  async transferToMultiSigAddress(num: number): Promise<void> {
    const tokenId = this.fromChain.testTokenId
    const balance = await this.fromChain.getTokenBalance(tokenId)
    const maxAmount = balance / BigInt(num)
    for (let i = 0; i < num; i++) {
      const multiSigAddressBytes = this.toChain.genMultiSigAddress()
      const multiSigAddressBase58 = base58.encode(multiSigAddressBytes)
      const alphBalanceBeforeTransfer = await this.toChain.getNativeTokenBalanceByAddress(multiSigAddressBase58)
      const balanceBeforeTransfer = await this.toChain.getWrappedTokenBalanceByAddress(
        tokenId,
        this.fromChain.chainId,
        multiSigAddressBase58
      )
      assert(alphBalanceBeforeTransfer === 0n)
      assert(balanceBeforeTransfer === 0n)

      const amount = randomBigInt(maxAmount, this.fromChain.normalizeTransferAmount)
      const transferResult = await this.fromChain.transferToken(
        tokenId,
        amount,
        this.toChain.chainId,
        multiSigAddressBytes,
        this.sequence.next()
      )
      await this.toChain.redeemToken(transferResult.signedVaa)

      const tokenBalanceAfterTransfer = await this.toChain.getWrappedTokenBalanceByAddress(
        tokenId,
        this.fromChain.chainId,
        multiSigAddressBase58
      )
      assert(tokenBalanceAfterTransfer === amount)
      const alphBalanceAfterTransfer = await this.toChain.getNativeTokenBalanceByAddress(multiSigAddressBase58)
      assert(alphBalanceAfterTransfer === alphBalanceBeforeTransfer + ONE_ALPH + DUST_AMOUNT)
    }
  }
}

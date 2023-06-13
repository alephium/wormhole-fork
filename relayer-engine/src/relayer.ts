import { addressFromContractId, groupOfAddress, web3 } from "@alephium/web3"
import {
  CHAIN_ID_ALEPHIUM,
  getIsTransferCompletedAlph,
  getIsTransferCompletedEth,
  getTokenBridgeForChainId,
  tryHexToNativeString,
  redeemOnAlphWithReward,
  redeemOnEth,
  redeemOnEthNative,
  TransferToken,
  uint8ArrayToHex,
  coalesceChainName,
  EVMChainId,
  isEVMChain
} from "alephium-wormhole-sdk"
import { vaaIdToString } from "./application"
import { Next } from "./compose.middleware"
import { WalletContext } from "./middleware"
import { getBridgeRewardRouterId, getTokenBridgeAddress, getWrappedNativeAddress } from "./utils"

export async function relay(ctx: WalletContext, next: Next) {
  const targetChain = ctx.vaa.parsed.body.targetChainId
  if (targetChain === CHAIN_ID_ALEPHIUM) {
    await relayAlph(ctx, next)
  } else if (isEVMChain(targetChain)) {
    await relayEVM(targetChain, ctx, next)
  } else {
    ctx.logger.error(`unknown target chain: ${coalesceChainName(targetChain)}, vaa id: ${vaaIdToString(ctx.vaa.id)}`)
  }
}

async function relayEVM(chainId: EVMChainId, ctx: WalletContext, next: Next) {
  await ctx.wallets.onEVM(chainId, async (wallet) => {
    const tokenBridgeAddress = getTokenBridgeAddress(ctx.networkId, chainId)
    const vaaId = vaaIdToString(ctx.vaa.id)
    const isCompleted = await getIsTransferCompletedEth(tokenBridgeAddress, wallet.wallet, ctx.vaa.bytes)
    if (isCompleted) {
      ctx.logger.info(`the vaa ${vaaId} is already redeemed, skipping`)
      return
    }

    const payload = ctx.vaa.parsed.body.payload as TransferToken
    const wrappedNative = getWrappedNativeAddress(ctx.networkId, chainId)
    const isNative = payload.originChain === chainId &&
      tryHexToNativeString(uint8ArrayToHex(payload.originAddress), payload.originChain).toLowerCase() === wrappedNative.toLowerCase()
    const receipt = isNative
      ? (await redeemOnEthNative(tokenBridgeAddress, wallet.wallet, ctx.vaa.bytes))
      : (await redeemOnEth(tokenBridgeAddress, wallet.wallet, ctx.vaa.bytes))
    ctx.logger.info(`submitted complete transfer to ${coalesceChainName(chainId)} with tx id ${receipt.transactionHash}, vaa id: ${vaaId}`)
  })
  await next()
}

async function relayAlph(ctx: WalletContext, next: Next) {
  await ctx.wallets.onAlephium(async (wallet) => {
    web3.setCurrentNodeProvider(ctx.providers.alephium[0])
    const tokenBridgeId = getTokenBridgeAddress(ctx.networkId, CHAIN_ID_ALEPHIUM)
    const bridgeRewardRouterId = getBridgeRewardRouterId(ctx.networkId, CHAIN_ID_ALEPHIUM)
    const groupIndex = groupOfAddress(addressFromContractId(tokenBridgeId))
    const sourceChain = ctx.vaa.parsed.body.emitterChainId
    const tokenBridgeForChainId = getTokenBridgeForChainId(tokenBridgeId, sourceChain, groupIndex)
    const vaaId = vaaIdToString(ctx.vaa.id)
    const isCompleted = await getIsTransferCompletedAlph(tokenBridgeForChainId, groupIndex, ctx.vaa.bytes)
    if (isCompleted) {
      ctx.logger.info(`the vaa ${vaaId} is already redeemed, skipping`)
      return
    }

    const result = await redeemOnAlphWithReward(wallet.wallet, bridgeRewardRouterId, tokenBridgeForChainId, ctx.vaa.bytes)
    ctx.logger.info(`submitted complete transfer to alephium with tx id ${result.txId}, vaa id: ${vaaId}`)
  })
  await next()
}

import { binToHex, DUST_AMOUNT, ExecuteScriptResult, SignerProvider } from "@alephium/web3";
import { ethers, Overrides } from "ethers";
import { CompleteTransfer, CompleteTransferWithReward } from "../alephium-contracts/ts/scripts";
import { Bridge__factory } from "../ethers-contracts";
import { CHAIN_ID_BSC, CHAIN_ID_ALEPHIUM } from "../utils";
import { tryUint8ArrayToNative } from "../utils/array";
import { TransferToken, VAA } from "../utils/vaa";

export async function redeemOnAlphWithReward(
  signerProvider: SignerProvider,
  bridgeRewardRouterId: string,
  tokenBridgeForChainId: string,
  signedVAA: Uint8Array
): Promise<ExecuteScriptResult> {
  return CompleteTransferWithReward.execute(signerProvider, {
    initialFields: {
      bridgeRewardRouter: bridgeRewardRouterId,
      tokenBridgeForChain: tokenBridgeForChainId,
      vaa: binToHex(signedVAA)
    },
    attoAlphAmount: DUST_AMOUNT * BigInt(2)
  })
}

export async function redeemOnAlph(
  signerProvider: SignerProvider,
  tokenBridgeForChainId: string,
  signedVAA: Uint8Array
): Promise<ExecuteScriptResult> {
  return CompleteTransfer.execute(signerProvider, {
    initialFields: {
      tokenBridgeForChain: tokenBridgeForChainId,
      vaa: binToHex(signedVAA)
    },
    attoAlphAmount: DUST_AMOUNT * BigInt(2)
  })
}

function deNormalizeAmount(amount: bigint, decimals: number): bigint {
  if (decimals > 8) {
    return amount * BigInt(10 ** (decimals - 8))
  }
  return amount
}

export function needToReward(
  vaa: VAA<TransferToken>,
  bscTokens: { id: string, minimal: string, decimals: number }[]
): boolean {
  if (vaa.body.targetChainId !== CHAIN_ID_ALEPHIUM) {
    return false
  }
  const payload = vaa.body.payload
  if (vaa.body.emitterChainId === CHAIN_ID_BSC) {
    if (payload.originChain === CHAIN_ID_BSC) {
      const tokenId = tryUint8ArrayToNative(payload.originAddress, CHAIN_ID_BSC).toLowerCase()
      const token = bscTokens.find((t) => t.id.toLowerCase() === tokenId)
      return token !== undefined && (deNormalizeAmount(payload.amount, token.decimals) >= BigInt(token.minimal))
    }
    return false
  }
  return true
}

export async function redeemOnEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: Overrides & { from?: string | Promise<string> } = {}
) {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.completeTransfer(signedVAA, overrides);
  const receipt = await v.wait();
  return receipt;
}

export async function redeemOnEthNative(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: Overrides & { from?: string | Promise<string> } = {}
) {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.completeTransferAndUnwrapETH(signedVAA, overrides);
  const receipt = await v.wait();
  return receipt;
}

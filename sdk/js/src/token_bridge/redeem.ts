import { binToHex, DUST_AMOUNT, ExecuteScriptResult, SignerProvider } from "@alephium/web3";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { Algodv2 } from "algosdk";
import { ethers, Overrides } from "ethers";
import { fromUint8Array } from "js-base64";
import { CompleteTransfer, CompleteTransferWithReward } from "../alephium-contracts/ts/scripts";
import { TransactionSignerPair, _submitVAAAlgorand } from "../algorand";
import { Bridge__factory } from "../ethers-contracts";
import { CHAIN_ID_BSC, CHAIN_ID_ALEPHIUM } from "../utils";
import { hexToNativeString, tryUint8ArrayToNative, uint8ArrayToHex } from "../utils/array";
import { deserializeTransferTokenVAA, TransferToken, VAA } from "../utils/vaa";

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

export async function redeemOnTerra(
  tokenBridgeAddress: string,
  walletAddress: string,
  signedVAA: Uint8Array
) {
  return new MsgExecuteContract(walletAddress, tokenBridgeAddress, {
    submit_vaa: {
      data: fromUint8Array(signedVAA),
    },
  });
}

/**
 * This basically just submits the VAA to Algorand
 * @param client AlgodV2 client
 * @param tokenBridgeId Token bridge ID
 * @param bridgeId Core bridge ID
 * @param vaa The VAA to be redeemed
 * @param acct Sending account
 * @returns Transaction ID(s)
 */
export async function redeemOnAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  bridgeId: bigint,
  vaa: Uint8Array,
  senderAddr: string
): Promise<TransactionSignerPair[]> {
  return await _submitVAAAlgorand(
    client,
    tokenBridgeId,
    bridgeId,
    vaa,
    senderAddr
  );
}

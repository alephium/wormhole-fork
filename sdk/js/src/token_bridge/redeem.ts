import { MsgExecuteContract } from "@terra-money/terra.js";
import { ethers, Overrides } from "ethers";
import { fromUint8Array } from "js-base64";
import { completeTransferScript, completeUndoneSequenceScript } from "../alephium/token_bridge";
import { Bridge__factory } from "../ethers-contracts";

export function redeemOnAlph(
  tokenWrapperId: string,
  signedVAA: Uint8Array,
  arbiterAddress: string
): string {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = completeTransferScript()
  return script.buildByteCode({
    tokenWrapperId: tokenWrapperId,
    vaa: vaaHex,
    arbiter: arbiterAddress
  })
}

export function completeUndoneSequence(
  tokenBridgeId: string,
  signedVAA: Uint8Array,
  arbiterAddress: string,
): string {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = completeUndoneSequenceScript()
  return script.buildByteCode({
    tokenBridgeId: tokenBridgeId,
    vaa: vaaHex,
    arbiter: arbiterAddress
  })
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

import { MsgExecuteContract } from "@terra-money/terra.js";
import { BuildScriptTx, SingleAddressSigner } from "alephium-web3";
import { ethers, Overrides } from "ethers";
import { fromUint8Array } from "js-base64";
import { completeTransferScript, completeUndoneSequenceScript } from "../alephium/token_bridge";
import { Bridge__factory } from "../ethers-contracts";
import { executeScript } from "./utils";

export async function redeemOnAlph(
  signer: SingleAddressSigner,
  tokenWrapperId: string,
  signedVAA: Uint8Array,
  arbiterAddress: string,
  params?: BuildScriptTx
) {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = completeTransferScript()
  const scriptParams = typeof params === 'undefined' ? {
    templateVariables: {
      tokenWrapperId: tokenWrapperId,
      vaa: vaaHex,
      arbiter: arbiterAddress
    }
  } : params
  return executeScript(signer, script, scriptParams)
}

export async function completeUndoneSequence(
  signer: SingleAddressSigner,
  tokenBridgeId: string,
  signedVAA: Uint8Array,
  arbiterAddress: string,
  params?: BuildScriptTx
) {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = completeUndoneSequenceScript()
  const scriptParams = typeof params === 'undefined' ? {
    templateVariables: {
      tokenBridgeId: tokenBridgeId,
      vaa: vaaHex,
      arbiter: arbiterAddress
    }
  } : params
  return executeScript(signer, script, scriptParams)
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

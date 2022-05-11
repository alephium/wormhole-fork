import { MsgExecuteContract } from "@terra-money/terra.js";
import { BuildScriptTx, Signer, SingleAddressSigner } from "alephium-web3";
import { ethers, Overrides } from "ethers";
import { fromUint8Array } from "js-base64";
import { createLocalTokenWrapperScript, createRemoteTokenWrapperScript } from "../alephium/token_bridge";
import { Bridge__factory } from "../ethers-contracts";
import { executeScript } from "./utils";

export async function createRemoteTokenWrapperOnAlph(
  signer: SingleAddressSigner,
  tokenBridgeForChainId: string,
  signedVAA: Uint8Array,
  payer: string,
  alphAmount: bigint,
  params?: BuildScriptTx
) {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = createRemoteTokenWrapperScript()
  const scriptParams = typeof params === 'undefined' ? {
    templateVariables: {
      payer: payer,
      tokenBridgeForChainId: tokenBridgeForChainId,
      vaa: vaaHex,
      alphAmount: alphAmount
    }
  } : params
  return executeScript(signer, script, scriptParams)
}

export async function createLocalTokenWrapperOnAlph(
  signer: SingleAddressSigner,
  tokenBridgeForChainId: string,
  localTokenId: string,
  payer: string,
  alphAmount: bigint,
  params?: BuildScriptTx
) {
  const script = createLocalTokenWrapperScript()
  const scriptParams = typeof params === 'undefined' ? {
    templateVariables: {
      payer: payer,
      tokenBridgeForChainId: tokenBridgeForChainId,
      tokenId: localTokenId,
      alphAmount: alphAmount
    }
  } : params
  return executeScript(signer, script, scriptParams)
}

export async function createWrappedOnEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: Overrides & { from?: string | Promise<string> } = {}
) {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.createWrapped(signedVAA, overrides);
  const receipt = await v.wait();
  return receipt;
}

export async function createWrappedOnTerra(
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

import { MsgExecuteContract } from "@terra-money/terra.js";
import { BuildScriptTx, Signer } from "alephium-web3";
import { ethers, Overrides } from "ethers";
import { fromUint8Array } from "js-base64";
import { createLocalTokenWrapperScript, createRemoteTokenWrapperScript } from "../alephium/token_bridge";
import { Bridge__factory } from "../ethers-contracts";
import { executeScript } from "./utils";

export async function createRemoteTokenWrapperOnAlph(
  signer: Signer,
  tokenBridgeForChainId: string,
  signedVAA: Uint8Array,
  payer: string,
  alphAmount: bigint,
  params?: BuildScriptTx
) {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = createRemoteTokenWrapperScript()
  return executeScript(signer, script, {
    payer: payer,
    tokenBridgeForChainId: tokenBridgeForChainId,
    vaa: vaaHex,
    alphAmount: alphAmount
  }, params)
}

export async function createLocalTokenWrapperOnAlph(
  signer: Signer,
  tokenBridgeForChainId: string,
  localTokenId: string,
  payer: string,
  alphAmount: bigint,
  params?: BuildScriptTx
) {
  const script = createLocalTokenWrapperScript()
  return executeScript(signer, script, {
    payer: payer,
    tokenBridgeForChainId: tokenBridgeForChainId,
    tokenId: localTokenId,
    alphAmount: alphAmount
  }, params)
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

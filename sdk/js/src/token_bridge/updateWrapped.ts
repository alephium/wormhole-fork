import { BuildScriptTxResult, SignerProvider } from "@alephium/web3";
import { ethers, Overrides } from "ethers";
import {
  createWrappedOnAlgorand,
  createWrappedOnSolana,
  createWrappedOnTerra,
} from ".";
import { updateRemoteTokenPoolScript } from "../alephium/token_bridge";
import { Bridge__factory } from "../ethers-contracts";

export async function updateRemoteTokenPoolOnAlph(
  signerProvider: SignerProvider,
  attestTokenHandlerId: string,
  signedVAA: Uint8Array
): Promise<BuildScriptTxResult> {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = updateRemoteTokenPoolScript()
  return script.execute(signerProvider, {
    initialFields: {
      attestTokenHandler: attestTokenHandlerId,
      vaa: vaaHex
    }
  })
}

export async function updateWrappedOnEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: Overrides & { from?: string | Promise<string> } = {}
) {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.updateWrapped(signedVAA, overrides);
  const receipt = await v.wait();
  return receipt;
}

export const updateWrappedOnTerra = createWrappedOnTerra;

export const updateWrappedOnSolana = createWrappedOnSolana;

export const updateWrappedOnAlgorand = createWrappedOnAlgorand;

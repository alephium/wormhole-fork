import { binToHex, ExecuteScriptResult, SignerProvider } from "@alephium/web3";
import { ethers, Overrides } from "ethers";
import {
  createWrappedOnAlgorand,
  createWrappedOnTerra,
} from ".";
import { UpdateRemoteTokenPool } from "../alephium-contracts/ts/scripts";
import { Bridge__factory } from "../ethers-contracts";

export async function updateRemoteTokenPoolOnAlph(
  signerProvider: SignerProvider,
  attestTokenHandlerId: string,
  signedVAA: Uint8Array
): Promise<ExecuteScriptResult> {
  return UpdateRemoteTokenPool.execute(signerProvider, {
    initialFields: {
      attestTokenHandler: attestTokenHandlerId,
      vaa: binToHex(signedVAA)
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

export const updateWrappedOnAlgorand = createWrappedOnAlgorand;

import { MsgExecuteContract } from "@terra-money/terra.js";
import { ethers, Overrides } from "ethers";
import { fromUint8Array } from "js-base64";
import { Bridge__factory } from "../ethers-contracts";

export async function redeemOnEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: Overrides & { from?: string | Promise<string> } = {}
): Promise<ethers.ContractReceipt> {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.completeTransfer(signedVAA, overrides);
  const receipt = await v.wait();
  return receipt;
}

export async function redeemOnTerra(
  tokenBridgeAddress: string,
  walletAddress: string,
  signedVAA: Uint8Array
): Promise<MsgExecuteContract> {
  return new MsgExecuteContract(walletAddress, tokenBridgeAddress, {
    submit_vaa: {
      data: fromUint8Array(signedVAA),
    },
  });
}

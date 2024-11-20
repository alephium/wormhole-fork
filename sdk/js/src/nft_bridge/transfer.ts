import { ethers, Overrides } from "ethers";
import {
  NFTBridge__factory,
  NFTImplementation__factory,
} from "../ethers-contracts";
import { ChainId, ChainName, coalesceChainId, createNonce } from "../utils";

export async function transferFromEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  tokenAddress: string,
  tokenID: ethers.BigNumberish,
  recipientChain: ChainId | ChainName,
  recipientAddress: Uint8Array,
  overrides: Overrides & { from?: string | Promise<string> } = {}
): Promise<ethers.ContractReceipt> {
  const recipientChainId = coalesceChainId(recipientChain)
  //TODO: should we check if token attestation exists on the target chain
  const token = NFTImplementation__factory.connect(tokenAddress, signer);
  await (await token.approve(tokenBridgeAddress, tokenID, overrides)).wait();
  const bridge = NFTBridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.transferNFT(
    tokenAddress,
    tokenID,
    recipientChainId,
    recipientAddress,
    createNonce(),
    overrides
  );
  const receipt = await v.wait();
  return receipt;
}

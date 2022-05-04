import { MsgExecuteContract } from "@terra-money/terra.js";
import { ethers, Overrides } from "ethers";
import {
  NFTBridge__factory,
  NFTImplementation__factory,
} from "../ethers-contracts";
import { ChainId, createNonce } from "../utils";

export async function transferFromEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  tokenAddress: string,
  tokenID: ethers.BigNumberish,
  recipientChain: ChainId,
  recipientAddress: Uint8Array,
  overrides: Overrides & { from?: string | Promise<string> } = {}
): Promise<ethers.ContractReceipt> {
  //TODO: should we check if token attestation exists on the target chain
  const token = NFTImplementation__factory.connect(tokenAddress, signer);
  await (await token.approve(tokenBridgeAddress, tokenID, overrides)).wait();
  const bridge = NFTBridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.transferNFT(
    tokenAddress,
    tokenID,
    recipientChain,
    recipientAddress,
    createNonce(),
    overrides
  );
  const receipt = await v.wait();
  return receipt;
}

export async function transferFromTerra(
  walletAddress: string,
  tokenBridgeAddress: string,
  tokenAddress: string,
  tokenID: string,
  recipientChain: ChainId,
  recipientAddress: Uint8Array
): Promise<MsgExecuteContract[]> {
  const nonce = Math.round(Math.random() * 100000);
  return [
    new MsgExecuteContract(
      walletAddress,
      tokenAddress,
      {
        approve: {
          spender: tokenBridgeAddress,
          token_id: tokenID,
        },
      },
      {}
    ),
    new MsgExecuteContract(
      walletAddress,
      tokenBridgeAddress,
      {
        initiate_transfer: {
          contract_addr: tokenAddress,
          token_id: tokenID,
          recipient_chain: recipientChain,
          recipient: Buffer.from(recipientAddress).toString("base64"),
          nonce: nonce,
        },
      },
      {}
    ),
  ];
}

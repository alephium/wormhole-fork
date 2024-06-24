import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { ethers, Overrides } from "ethers";
import { fromUint8Array } from "js-base64";
import { CHAIN_ID_SOLANA, deserializeTransferNFTVAA } from "..";
import { Bridge__factory } from "../ethers-contracts";
import {
  createCompleteTransferNativeInstruction,
  createCompleteTransferWrappedInstruction,
  createCompleteWrappedMetaInstruction
} from "../solana/nftBridge";

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

export async function isNFTVAASolanaNative(
  signedVAA: Uint8Array
): Promise<boolean> {
  return deserializeTransferNFTVAA(signedVAA).body.payload.originChain === CHAIN_ID_SOLANA
}

export async function redeemOnSolana(
  connection: Connection,
  bridgeAddress: string,
  nftBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
): Promise<Transaction> {
  const parsed = deserializeTransferNFTVAA(signedVAA);
  const createCompleteTransferInstruction =
    parsed.body.payload.originChain == CHAIN_ID_SOLANA
      ? createCompleteTransferNativeInstruction
      : createCompleteTransferWrappedInstruction;
  const transaction = new Transaction().add(
    createCompleteTransferInstruction(
      nftBridgeAddress,
      bridgeAddress,
      payerAddress,
      signedVAA
    )
  );
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(payerAddress);
  return transaction;
}

export async function createMetaOnSolana(
  connection: Connection,
  bridgeAddress: string,
  nftBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
): Promise<Transaction> {
  const parsed = deserializeTransferNFTVAA(signedVAA);
  if (parsed.body.payload.originChain == CHAIN_ID_SOLANA) {
    return Promise.reject("parsed.tokenChain == CHAIN_ID_SOLANA");
  }
  const transaction = new Transaction().add(
    createCompleteWrappedMetaInstruction(
      nftBridgeAddress,
      bridgeAddress,
      payerAddress,
      signedVAA
    )
  );
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(payerAddress);
  return transaction;
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

import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { BuildScriptTx, Signer } from "alephium-js";
import { ethers, Overrides } from "ethers";
import { fromUint8Array } from "js-base64";
import { createLocalTokenWrapperCode, createRemoteTokenWrapperCode } from "../alephium/token_bridge";
import { Bridge__factory } from "../ethers-contracts";
import { ixFromRust } from "../solana";
import { importTokenWasm } from "../solana/wasm";
import { toHex } from "../utils/hex";
import { executeScript } from "./utils";

export async function createRemoteTokenWrapperOnAlph(
  signer: Signer,
  tokenBridgeForChainAddress: string,
  signedVAA: Uint8Array,
  payer: string,
  alphAmount: bigint,
  params?: BuildScriptTx
) {
  const vaaHex = toHex(signedVAA)
  const bytecode = createRemoteTokenWrapperCode(tokenBridgeForChainAddress, vaaHex, payer, alphAmount)
  return executeScript(signer, bytecode, params)
}

export async function createLocalTokenWrapperOnAlph(
  signer: Signer,
  tokenBridgeForChainAddress: string,
  localTokenId: string,
  payer: string,
  alphAmount: bigint,
  params?: BuildScriptTx
) {
  const bytecode = createLocalTokenWrapperCode(tokenBridgeForChainAddress, localTokenId, payer, alphAmount)
  return executeScript(signer, bytecode, params)
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

export async function createWrappedOnSolana(
  connection: Connection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
) {
  const { create_wrapped_ix } = await importTokenWasm();
  const ix = ixFromRust(
    create_wrapped_ix(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      signedVAA
    )
  );
  const transaction = new Transaction().add(ix);
  const { blockhash } = await connection.getRecentBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(payerAddress);
  return transaction;
}

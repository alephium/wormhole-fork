import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { BuildScriptTx, Signer } from "alephium-web3";
import { ethers, Overrides } from "ethers";
import { fromUint8Array } from "js-base64";
import { createLocalTokenWrapperScript, createRemoteTokenWrapperScript } from "../alephium/token_bridge";
import { Bridge__factory } from "../ethers-contracts";
import { ixFromRust } from "../solana";
import { importTokenWasm } from "../solana/wasm";
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
  const script = await createRemoteTokenWrapperScript()
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
  const script = await createLocalTokenWrapperScript()
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

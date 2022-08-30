import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { Algodv2 } from "algosdk";
import { ethers, Overrides } from "ethers";
import { fromUint8Array } from "js-base64";
import { createLocalTokenPoolScript, createRemoteTokenPoolScript, createWrappedAlphPoolScript } from "../alephium/token_bridge";
import { TransactionSignerPair, _submitVAAAlgorand } from "../algorand";
import { Bridge__factory } from "../ethers-contracts";
import { ixFromRust } from "../solana";
import { importTokenWasm } from "../solana/wasm";

export function createRemoteTokenPoolOnAlph(
  attestTokenHandlerId: string,
  signedVAA: Uint8Array,
  payer: string,
  alphAmount: bigint
): string {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = createRemoteTokenPoolScript()
  return script.buildByteCodeToDeploy({
    payer: payer,
    attestTokenHandler: attestTokenHandlerId,
    vaa: vaaHex,
    alphAmount: alphAmount
  })
}

export function createLocalTokenPoolOnAlph(
  tokenBridgeId: string,
  localTokenId: string,
  payer: string,
  alphAmount: bigint
): string {
  const script = createLocalTokenPoolScript()
  return script.buildByteCodeToDeploy({
    payer: payer,
    tokenBridge: tokenBridgeId,
    tokenId: localTokenId,
    alphAmount: alphAmount
  })
}

export function createWrappedAlphPool(
  tokenBridgeId: string,
  payer: string,
  alphAmount: bigint
): string {
  const script = createWrappedAlphPoolScript()
  return script.buildByteCodeToDeploy({
    payer: payer,
    tokenBridge: tokenBridgeId,
    alphAmount: alphAmount
  })
}

export async function createWrappedOnEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: Overrides & { from?: string | Promise<string> } = {}
): Promise<ethers.ContractReceipt> {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.createWrapped(signedVAA, overrides);
  const receipt = await v.wait();
  return receipt;
}

export async function createWrappedOnTerra(
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

export async function createWrappedOnSolana(
  connection: Connection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
): Promise<Transaction> {
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

export async function createWrappedOnAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  bridgeId: bigint,
  senderAddr: string,
  attestVAA: Uint8Array
): Promise<TransactionSignerPair[]> {
  return await _submitVAAAlgorand(
    client,
    tokenBridgeId,
    bridgeId,
    attestVAA,
    senderAddr
  );
}

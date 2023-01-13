import { ALPH_TOKEN_ID, BuildScriptTxResult, SignerProvider } from "@alephium/web3";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { Algodv2 } from "algosdk";
import { ethers, Overrides } from "ethers";
import { fromUint8Array } from "js-base64";
import {
  createLocalTokenPoolScript,
  createRemoteTokenPoolScript
} from "../alephium/token_bridge";
import { TransactionSignerPair, _submitVAAAlgorand } from "../algorand";
import { Bridge__factory } from "../ethers-contracts";
import { ixFromRust } from "../solana";
import { importTokenWasm } from "../solana/wasm";

export async function createRemoteTokenPoolOnAlph(
  signerProvider: SignerProvider,
  attestTokenHandlerId: string,
  signedVAA: Uint8Array,
  payer: string,
  alphAmount: bigint
): Promise<BuildScriptTxResult> {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = createRemoteTokenPoolScript()
  return script.execute(signerProvider, {
    initialFields: {
      payer: payer,
      attestTokenHandler: attestTokenHandlerId,
      vaa: vaaHex,
      alphAmount: alphAmount
    },
    attoAlphAmount: alphAmount
  })
}

export async function createLocalTokenPoolOnAlph(
  signerProvider: SignerProvider,
  attestTokenHandlerId: string,
  localTokenId: string,
  signedVAA: Uint8Array,
  payer: string,
  alphAmount: bigint
): Promise<BuildScriptTxResult> {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = createLocalTokenPoolScript()
  return script.execute(signerProvider, {
    initialFields: {
      payer: payer,
      attestTokenHandler: attestTokenHandlerId,
      localTokenId: localTokenId,
      vaa: vaaHex,
      alphAmount: alphAmount
    },
    attoAlphAmount: alphAmount,
    tokens: localTokenId === ALPH_TOKEN_ID ? [] : [{ id: localTokenId, amount: BigInt(1) }]
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

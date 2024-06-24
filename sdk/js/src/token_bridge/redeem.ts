import { binToHex, DUST_AMOUNT, ExecuteScriptResult, SignerProvider } from "@alephium/web3";
import { AccountLayout, NATIVE_MINT, Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { Algodv2 } from "algosdk";
import { ethers, Overrides } from "ethers";
import { fromUint8Array } from "js-base64";
import { CompleteTransfer, CompleteTransferWithReward } from "../alephium-contracts/ts/scripts";
import { TransactionSignerPair, _submitVAAAlgorand } from "../algorand";
import { Bridge__factory } from "../ethers-contracts";
import {
  CHAIN_ID_SOLANA,
  WSOL_DECIMALS,
  MAX_VAA_DECIMALS,
} from "../utils";
import { deserializeTransferTokenVAA } from "../utils/vaa";
import { createCompleteTransferNativeInstruction, createCompleteTransferWrappedInstruction } from "../solana/tokenBridge";

export async function redeemOnAlphWithReward(
  signerProvider: SignerProvider,
  bridgeRewardRouterId: string,
  tokenBridgeForChainId: string,
  signedVAA: Uint8Array
): Promise<ExecuteScriptResult> {
  return CompleteTransferWithReward.execute(signerProvider, {
    initialFields: {
      bridgeRewardRouter: bridgeRewardRouterId,
      tokenBridgeForChain: tokenBridgeForChainId,
      vaa: binToHex(signedVAA)
    },
    attoAlphAmount: DUST_AMOUNT * BigInt(2)
  })
}

export async function redeemOnAlph(
  signerProvider: SignerProvider,
  tokenBridgeForChainId: string,
  signedVAA: Uint8Array
): Promise<ExecuteScriptResult> {
  return CompleteTransfer.execute(signerProvider, {
    initialFields: {
      tokenBridgeForChain: tokenBridgeForChainId,
      vaa: binToHex(signedVAA)
    },
    attoAlphAmount: DUST_AMOUNT * BigInt(2)
  })
}

export async function redeemOnEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: Overrides & { from?: string | Promise<string> } = {}
) {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.completeTransfer(signedVAA, overrides);
  const receipt = await v.wait();
  return receipt;
}

export async function redeemOnEthNative(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: Overrides & { from?: string | Promise<string> } = {}
) {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.completeTransferAndUnwrapETH(signedVAA, overrides);
  const receipt = await v.wait();
  return receipt;
}

export async function redeemOnTerra(
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

export async function redeemAndUnwrapOnSolana(
  connection: Connection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array
) {
  const parsed = deserializeTransferTokenVAA(signedVAA);
  const targetPublicKey = new PublicKey(parsed.body.payload.targetAddress);
  const targetAmount =
    parsed.body.payload.amount * BigInt(Math.pow(10, WSOL_DECIMALS - MAX_VAA_DECIMALS))
  const rentBalance = await Token.getMinBalanceRentForExemptAccount(connection);
  if (Buffer.compare(parsed.body.payload.originAddress, NATIVE_MINT.toBuffer()) != 0) {
    return Promise.reject("tokenAddress != NATIVE_MINT");
  }
  const payerPublicKey = new PublicKey(payerAddress);
  const ancillaryKeypair = Keypair.generate();

  const completeTransferIx = createCompleteTransferNativeInstruction(
    tokenBridgeAddress,
    bridgeAddress,
    payerPublicKey,
    signedVAA
  );

  //This will create a temporary account where the wSOL will be moved
  const createAncillaryAccountIx = SystemProgram.createAccount({
    fromPubkey: payerPublicKey,
    newAccountPubkey: ancillaryKeypair.publicKey,
    lamports: rentBalance, //spl token accounts need rent exemption
    space: AccountLayout.span,
    programId: TOKEN_PROGRAM_ID,
  });

  //Initialize the account as a WSOL account, with the original payerAddress as owner
  const initAccountIx = Token.createInitAccountInstruction(
    TOKEN_PROGRAM_ID,
    ancillaryKeypair.publicKey,
    NATIVE_MINT,
    payerPublicKey
  );

  //Send in the amount of wSOL which we want converted to SOL
  const balanceTransferIx = Token.createTransferInstruction(
    TOKEN_PROGRAM_ID,
    targetPublicKey,
    ancillaryKeypair.publicKey,
    payerPublicKey,
    [],
    Number(targetAmount)
  );

  //Close the ancillary account for cleanup. Payer address receives any remaining funds
  const closeAccountIx = Token.createCloseAccountInstruction(
    TOKEN_PROGRAM_ID,
    ancillaryKeypair.publicKey, //account to close
    payerPublicKey, //Remaining funds destination
    payerPublicKey, //authority
    []
  );

  const { blockhash } = await connection.getLatestBlockhash();
  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = payerPublicKey;
  transaction.add(
    completeTransferIx,
    createAncillaryAccountIx,
    initAccountIx,
    balanceTransferIx,
    closeAccountIx
  );
  transaction.partialSign(ancillaryKeypair);
  return transaction;
}

export async function redeemOnSolana(
  connection: Connection,
  bridgeAddress: string,
  tokenBridgeAddress: string,
  payerAddress: string,
  signedVAA: Uint8Array,
  feeRecipientAddress?: string
) {
  const parsed = deserializeTransferTokenVAA(signedVAA);
  const createCompleteTransferInstruction =
    parsed.body.payload.originChain == CHAIN_ID_SOLANA
      ? createCompleteTransferNativeInstruction
      : createCompleteTransferWrappedInstruction;
  const transaction = new Transaction().add(
    createCompleteTransferInstruction(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      signedVAA,
      feeRecipientAddress
    )
  );
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(payerAddress);
  return transaction;
}

/**
 * This basically just submits the VAA to Algorand
 * @param client AlgodV2 client
 * @param tokenBridgeId Token bridge ID
 * @param bridgeId Core bridge ID
 * @param vaa The VAA to be redeemed
 * @param acct Sending account
 * @returns Transaction ID(s)
 */
export async function redeemOnAlgorand(
  client: Algodv2,
  tokenBridgeId: bigint,
  bridgeId: bigint,
  vaa: Uint8Array,
  senderAddr: string
): Promise<TransactionSignerPair[]> {
  return await _submitVAAAlgorand(
    client,
    tokenBridgeId,
    bridgeId,
    vaa,
    senderAddr
  );
}

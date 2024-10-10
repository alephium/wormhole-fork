import { binToHex, DUST_AMOUNT, ExecuteScriptResult, SignerProvider } from "@alephium/web3";
import { AccountLayout, Token, TOKEN_PROGRAM_ID, u64 } from "@solana/spl-token";
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
import { ixFromRust } from "../solana";
import { importCoreWasm, importTokenWasm } from "../solana/wasm";
import {
  CHAIN_ID_SOLANA,
  WSOL_ADDRESS,
  WSOL_DECIMALS,
  MAX_VAA_DECIMALS,
  CHAIN_ID_BSC,
  CHAIN_ID_ALEPHIUM,
} from "../utils";
import { hexToNativeString, tryUint8ArrayToNative, uint8ArrayToHex } from "../utils/array";
import { deserializeTransferTokenVAA, TransferToken, VAA } from "../utils/vaa";

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

function deNormalizeAmount(amount: bigint, decimals: number): bigint {
  if (decimals > 8) {
    return amount * BigInt(10 ** (decimals - 8))
  }
  return amount
}

export function needToReward(
  vaa: VAA<TransferToken>,
  bscTokens: { id: string, minimal: string, decimals: number }[]
): boolean {
  if (vaa.body.targetChainId !== CHAIN_ID_ALEPHIUM) {
    return false
  }
  const payload = vaa.body.payload
  if (vaa.body.emitterChainId === CHAIN_ID_BSC) {
    if (payload.originChain === CHAIN_ID_BSC) {
      const tokenId = tryUint8ArrayToNative(payload.originAddress, CHAIN_ID_BSC).toLowerCase()
      const token = bscTokens.find((t) => t.id.toLowerCase() === tokenId)
      return token !== undefined && (deNormalizeAmount(payload.amount, token.decimals) >= BigInt(token.minimal))
    }
    return false
  }
  return true
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
  const { complete_transfer_native_ix } = await importTokenWasm();
  const parsedVAA = deserializeTransferTokenVAA(signedVAA)
  const parsedPayload = parsedVAA.body.payload
  const targetAddress = hexToNativeString(
    uint8ArrayToHex(parsedPayload.targetAddress),
    CHAIN_ID_SOLANA
  );
  if (!targetAddress) {
    throw new Error("Failed to read the target address.");
  }
  const targetPublicKey = new PublicKey(targetAddress);
  const targetAmount =
    parsedPayload.amount *
    BigInt(WSOL_DECIMALS - MAX_VAA_DECIMALS) *
    BigInt(10);
  const rentBalance = await Token.getMinBalanceRentForExemptAccount(connection);
  const mintPublicKey = new PublicKey(WSOL_ADDRESS);
  const payerPublicKey = new PublicKey(payerAddress);
  const ancillaryKeypair = Keypair.generate();

  const completeTransferIx = ixFromRust(
    complete_transfer_native_ix(
      tokenBridgeAddress,
      bridgeAddress,
      payerAddress,
      signedVAA
    )
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
  const initAccountIx = await Token.createInitAccountInstruction(
    TOKEN_PROGRAM_ID,
    mintPublicKey,
    ancillaryKeypair.publicKey,
    payerPublicKey
  );

  //Send in the amount of wSOL which we want converted to SOL
  const balanceTransferIx = Token.createTransferInstruction(
    TOKEN_PROGRAM_ID,
    targetPublicKey,
    ancillaryKeypair.publicKey,
    payerPublicKey,
    [],
    new u64(targetAmount.toString(16), 16)
  );

  //Close the ancillary account for cleanup. Payer address receives any remaining funds
  const closeAccountIx = Token.createCloseAccountInstruction(
    TOKEN_PROGRAM_ID,
    ancillaryKeypair.publicKey, //account to close
    payerPublicKey, //Remaining funds destination
    payerPublicKey, //authority
    []
  );

  const { blockhash } = await connection.getRecentBlockhash();
  const transaction = new Transaction();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(payerAddress);
  transaction.add(completeTransferIx);
  transaction.add(createAncillaryAccountIx);
  transaction.add(initAccountIx);
  transaction.add(balanceTransferIx);
  transaction.add(closeAccountIx);
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
  const { parse_vaa } = await importCoreWasm();
  const parsedVAA = parse_vaa(signedVAA);
  const isSolanaNative =
    Buffer.from(new Uint8Array(parsedVAA.payload)).readUInt16BE(65) ===
    CHAIN_ID_SOLANA;
  const { complete_transfer_wrapped_ix, complete_transfer_native_ix } =
    await importTokenWasm();
  const ixs = [];
  if (isSolanaNative) {
    ixs.push(
      ixFromRust(
        complete_transfer_native_ix(
          tokenBridgeAddress,
          bridgeAddress,
          payerAddress,
          signedVAA,
          feeRecipientAddress
        )
      )
    );
  } else {
    ixs.push(
      ixFromRust(
        complete_transfer_wrapped_ix(
          tokenBridgeAddress,
          bridgeAddress,
          payerAddress,
          signedVAA,
          feeRecipientAddress
        )
      )
    );
  }
  const transaction = new Transaction().add(...ixs);
  const { blockhash } = await connection.getRecentBlockhash();
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

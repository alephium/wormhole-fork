import {
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createReadOnlyTokenBridgeProgramInterface } from "../program";
import { deriveClaimKey, derivePostedVaaKey } from "../../wormhole";
import {
  deriveEndpointKey,
  deriveTokenBridgeConfigKey,
  deriveWrappedMintKey,
  deriveWrappedMetaKey,
  deriveMintAuthorityKey,
} from "../accounts";
import { deserializeTransferTokenVAA } from "../../../utils/vaa";
import { arrayify } from "ethers/lib/utils";
import { getSignedVAAHash } from "../../../bridge";

export function createCompleteTransferWrappedInstruction(
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: Uint8Array,
  feeRecipient?: PublicKeyInitData
): TransactionInstruction {
  const methods =
    createReadOnlyTokenBridgeProgramInterface(
      tokenBridgeProgramId
    ).methods.completeWrapped();

  // @ts-ignore
  return methods._ixFn(...methods._args, {
    accounts: getCompleteTransferWrappedAccounts(
      tokenBridgeProgramId,
      wormholeProgramId,
      payer,
      vaa,
      feeRecipient
    ) as any,
    signers: undefined,
    remainingAccounts: undefined,
    preInstructions: undefined,
    postInstructions: undefined,
  });
}

export interface CompleteTransferWrappedAccounts {
  payer: PublicKey;
  config: PublicKey;
  vaa: PublicKey;
  claim: PublicKey;
  endpoint: PublicKey;
  to: PublicKey;
  toFees: PublicKey;
  mint: PublicKey;
  wrappedMeta: PublicKey;
  mintAuthority: PublicKey;
  rent: PublicKey;
  systemProgram: PublicKey;
  tokenProgram: PublicKey;
  wormholeProgram: PublicKey;
}

export function getCompleteTransferWrappedAccounts(
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: Uint8Array,
  feeRecipient?: PublicKeyInitData
): CompleteTransferWrappedAccounts {
  const parsed = deserializeTransferTokenVAA(vaa);
  const mint = deriveWrappedMintKey(
    tokenBridgeProgramId,
    parsed.body.payload.originChain,
    parsed.body.payload.originAddress
  );
  const vaaHash = arrayify(getSignedVAAHash(vaa))
  return {
    payer: new PublicKey(payer),
    config: deriveTokenBridgeConfigKey(tokenBridgeProgramId),
    vaa: derivePostedVaaKey(wormholeProgramId, vaaHash),
    claim: deriveClaimKey(
      tokenBridgeProgramId,
      parsed.body.emitterAddress,
      parsed.body.emitterChainId,
      parsed.body.sequence
    ),
    endpoint: deriveEndpointKey(
      tokenBridgeProgramId,
      parsed.body.emitterChainId,
      parsed.body.emitterAddress
    ),
    to: new PublicKey(parsed.body.payload.targetAddress),
    toFees: new PublicKey(
      feeRecipient === undefined ? parsed.body.payload.targetAddress : feeRecipient
    ),
    mint,
    wrappedMeta: deriveWrappedMetaKey(tokenBridgeProgramId, mint),
    mintAuthority: deriveMintAuthorityKey(tokenBridgeProgramId),
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    wormholeProgram: new PublicKey(wormholeProgramId),
  };
}

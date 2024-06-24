import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { deserializeTransferNFTVAA } from "../../../utils/vaa";
import { TOKEN_METADATA_PROGRAM_ID } from "../../utils";
import { deriveClaimKey, derivePostedVaaKey } from "../../wormhole";
import {
  deriveEndpointKey,
  deriveMintAuthorityKey,
  deriveNftBridgeConfigKey,
  deriveWrappedMetaKey,
  deriveWrappedMintKey,
} from "../accounts";
import { createReadOnlyNftBridgeProgramInterface } from "../program";
import { getSignedVAAHash } from "../../../bridge";
import { arrayify } from "ethers/lib/utils";

export function createCompleteTransferWrappedInstruction(
  nftBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: Uint8Array,
  toAuthority?: PublicKeyInitData
): TransactionInstruction {
  const methods =
    createReadOnlyNftBridgeProgramInterface(
      nftBridgeProgramId
    ).methods.completeWrapped();

  // @ts-ignore
  return methods._ixFn(...methods._args, {
    accounts: getCompleteTransferWrappedAccounts(
      nftBridgeProgramId,
      wormholeProgramId,
      payer,
      vaa,
      toAuthority
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
  toAuthority: PublicKey;
  mint: PublicKey;
  wrappedMeta: PublicKey;
  mintAuthority: PublicKey;
  rent: PublicKey;
  systemProgram: PublicKey;
  tokenProgram: PublicKey;
  splMetadataProgram: PublicKey;
  associatedTokenProgram: PublicKey;
  wormholeProgram: PublicKey;
}

export function getCompleteTransferWrappedAccounts(
  nftBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: Uint8Array,
  toAuthority?: PublicKeyInitData
): CompleteTransferWrappedAccounts {
  const parsed = deserializeTransferNFTVAA(vaa);
  const mint = deriveWrappedMintKey(
    nftBridgeProgramId,
    parsed.body.payload.originChain,
    parsed.body.payload.originAddress,
    parsed.body.payload.tokenId
  );
  const vaaHash = arrayify(getSignedVAAHash(vaa))
  return {
    payer: new PublicKey(payer),
    config: deriveNftBridgeConfigKey(nftBridgeProgramId),
    vaa: derivePostedVaaKey(wormholeProgramId, vaaHash),
    claim: deriveClaimKey(
      nftBridgeProgramId,
      parsed.body.emitterAddress,
      parsed.body.emitterChainId,
      parsed.body.sequence
    ),
    endpoint: deriveEndpointKey(
      nftBridgeProgramId,
      parsed.body.emitterChainId,
      parsed.body.emitterAddress
    ),
    to: new PublicKey(parsed.body.payload.targetAddress),
    toAuthority: new PublicKey(toAuthority === undefined ? payer : toAuthority),
    mint,
    wrappedMeta: deriveWrappedMetaKey(nftBridgeProgramId, mint),
    mintAuthority: deriveMintAuthorityKey(nftBridgeProgramId),
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    splMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    wormholeProgram: new PublicKey(wormholeProgramId),
  };
}

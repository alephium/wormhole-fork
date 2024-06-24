import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { deserializeTransferNFTVAA } from "../../../utils/vaa";
import { deriveTokenMetadataKey, TOKEN_METADATA_PROGRAM_ID } from "../../utils";
import { derivePostedVaaKey } from "../../wormhole";
import {
  deriveEndpointKey,
  deriveMintAuthorityKey,
  deriveNftBridgeConfigKey,
  deriveWrappedMetaKey,
  deriveWrappedMintKey,
} from "../accounts";
import { createReadOnlyNftBridgeProgramInterface } from "../program";
import { arrayify } from "ethers/lib/utils";
import { getSignedVAAHash } from "../../../bridge";

export function createCompleteWrappedMetaInstruction(
  nftBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: Uint8Array
): TransactionInstruction {
  const methods =
    createReadOnlyNftBridgeProgramInterface(
      nftBridgeProgramId
    ).methods.completeWrappedMeta();

  // @ts-ignore
  return methods._ixFn(...methods._args, {
    accounts: getCompleteWrappedMetaAccounts(
      nftBridgeProgramId,
      wormholeProgramId,
      payer,
      vaa
    ) as any,
    signers: undefined,
    remainingAccounts: undefined,
    preInstructions: undefined,
    postInstructions: undefined,
  });
}

export interface CompleteWrappedMetaAccounts {
  payer: PublicKey;
  config: PublicKey;
  vaa: PublicKey;
  endpoint: PublicKey;
  mint: PublicKey;
  wrappedMeta: PublicKey;
  splMetadata: PublicKey;
  mintAuthority: PublicKey;
  rent: PublicKey;
  systemProgram: PublicKey;
  tokenProgram: PublicKey;
  splMetadataProgram: PublicKey;
  wormholeProgram: PublicKey;
}

export function getCompleteWrappedMetaAccounts(
  nftBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: Uint8Array
): CompleteWrappedMetaAccounts {
  const parsed = deserializeTransferNFTVAA(vaa)
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
    endpoint: deriveEndpointKey(
      nftBridgeProgramId,
      parsed.body.emitterChainId,
      parsed.body.emitterAddress
    ),
    mint,
    wrappedMeta: deriveWrappedMetaKey(nftBridgeProgramId, mint),
    splMetadata: deriveTokenMetadataKey(mint),
    mintAuthority: deriveMintAuthorityKey(nftBridgeProgramId),
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    splMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    wormholeProgram: new PublicKey(wormholeProgramId),
  };
}

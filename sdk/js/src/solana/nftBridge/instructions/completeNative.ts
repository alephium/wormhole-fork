import {
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  createReadOnlyNftBridgeProgramInterface,
  tokenIdToMint,
} from "../program";
import { deriveClaimKey, derivePostedVaaKey } from "../../wormhole";
import {
  deriveEndpointKey,
  deriveNftBridgeConfigKey,
  deriveCustodyKey,
  deriveCustodySignerKey,
} from "../accounts";
import { deserializeTransferNFTVAA } from "../../../utils/vaa";
import { getSignedVAAHash } from "../../../bridge";
import { arrayify } from "ethers/lib/utils";

export function createCompleteTransferNativeInstruction(
  nftBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: Uint8Array,
  toAuthority?: PublicKeyInitData
): TransactionInstruction {
  const methods =
    createReadOnlyNftBridgeProgramInterface(
      nftBridgeProgramId
    ).methods.completeNative();

  // @ts-ignore
  return methods._ixFn(...methods._args, {
    accounts: getCompleteTransferNativeAccounts(
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

export interface CompleteTransferNativeAccounts {
  payer: PublicKey;
  config: PublicKey;
  vaa: PublicKey;
  claim: PublicKey;
  endpoint: PublicKey;
  to: PublicKey;
  toAuthority: PublicKey;
  custody: PublicKey;
  mint: PublicKey;
  custodySigner: PublicKey;
  rent: PublicKey;
  systemProgram: PublicKey;
  tokenProgram: PublicKey;
  wormholeProgram: PublicKey;
}

export function getCompleteTransferNativeAccounts(
  nftBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: Uint8Array,
  toAuthority?: PublicKeyInitData
): CompleteTransferNativeAccounts {
  const parsed = deserializeTransferNFTVAA(vaa);
  // the mint key is encoded in the tokenId when it was transferred out
  const mint = tokenIdToMint(parsed.body.payload.tokenId);
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
    custody: deriveCustodyKey(nftBridgeProgramId, mint),
    mint,
    custodySigner: deriveCustodySignerKey(nftBridgeProgramId),
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    wormholeProgram: new PublicKey(wormholeProgramId),
  };
}

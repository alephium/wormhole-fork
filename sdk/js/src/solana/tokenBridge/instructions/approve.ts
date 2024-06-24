import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, PublicKeyInitData } from "@solana/web3.js";
import { deriveAuthoritySignerKey } from "../accounts";

export function createApproveAuthoritySignerInstruction(
  tokenBridgeProgramId: PublicKeyInitData,
  tokenAccount: PublicKeyInitData,
  owner: PublicKeyInitData,
  amount: number | bigint
) {
  return Token.createApproveInstruction(
    TOKEN_PROGRAM_ID,
    new PublicKey(tokenAccount),
    deriveAuthoritySignerKey(tokenBridgeProgramId),
    new PublicKey(owner),
    [],
    Number(amount),
  );
}

import { deserializeVAA } from "../utils";
import { deriveClaimKey } from "../solana/wormhole";

export async function getClaimAddressSolana(
  programAddress: string,
  signedVAA: Uint8Array
) {
  const parsed = deserializeVAA(signedVAA);
  return deriveClaimKey(
    programAddress,
    parsed.body.emitterAddress,
    parsed.body.emitterChainId,
    parsed.body.sequence
  );
}

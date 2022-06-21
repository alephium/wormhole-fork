import { ethers } from "ethers";
import { uint8ArrayToHex } from "..";
import { VAA } from "../utils";

export async function getSignedVAAHash(signedVAA: Uint8Array) {
  const parsedVAA = VAA.from(signedVAA);
  const body = uint8ArrayToHex(parsedVAA.encodedBody);
  return ethers.utils.solidityKeccak256(["bytes"], [ethers.utils.solidityKeccak256(["bytes"], ["0x" + body])]);
}

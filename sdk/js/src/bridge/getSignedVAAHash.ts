import { ethers } from "ethers";
import { uint8ArrayToHex } from "..";
import { extractBodyFromVAA } from "../utils";

export function getSignedVAAHash(signedVAA: Uint8Array) {
  const body = extractBodyFromVAA(signedVAA)
  const bodyHex = uint8ArrayToHex(body)
  return ethers.utils.solidityKeccak256(["bytes"], [ethers.utils.solidityKeccak256(["bytes"], ["0x" + bodyHex])])
}

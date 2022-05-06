import { bech32 } from "bech32";
import { arrayify, BytesLike, Hexable, zeroPad } from "ethers/lib/utils";

export function getEmitterAddressEth(
  contractAddress: number | BytesLike | Hexable
) {
  return Buffer.from(zeroPad(arrayify(contractAddress), 32)).toString("hex");
}

export async function getEmitterAddressTerra(programAddress: string) {
  return Buffer.from(
    zeroPad(bech32.fromWords(bech32.decode(programAddress).words), 32)
  ).toString("hex");
}

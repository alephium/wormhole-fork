import { ethers, PayableOverrides } from "ethers";
import { Bridge__factory } from "../ethers-contracts";
import { textToHexString, textToUint8Array, uint8ArrayToHex, utf8StringTo32Bytes } from "../utils";
import { safeBigIntToNumber } from "../utils/bigint";
import { createNonce } from "../utils/createNonce";
import { ALPH_TOKEN_ID, binToHex, DUST_AMOUNT, ExecuteScriptResult, isHexString, SignerProvider } from "@alephium/web3";
import { AttestToken } from "../alephium-contracts/ts/scripts"

function normalizeString(str: string): string {
  if (isHexString(str) && str.length === 64) {
    return str
  }
  return binToHex(utf8StringTo32Bytes(str))
}

export async function attestFromAlph(
  signerProvider: SignerProvider,
  tokenBridgeId: string,
  localTokenId: string,
  decimals: number,
  symbol: string,
  name: string,
  payer: string,
  messageFee: bigint,
  consistencyLevel: number,
  nonce?: string
): Promise<ExecuteScriptResult> {
  const nonceHex = (typeof nonce !== "undefined") ? nonce : createNonce().toString('hex')
  return AttestToken.execute({
    signer: signerProvider,
    initialFields: {
      payer: payer,
      tokenBridge: tokenBridgeId,
      localTokenId: localTokenId,
      decimals: BigInt(decimals),
      symbol: normalizeString(symbol),
      name: normalizeString(name),
      nonce: nonceHex,
      consistencyLevel: BigInt(consistencyLevel)
    },
    attoAlphAmount: messageFee + (localTokenId === ALPH_TOKEN_ID ? DUST_AMOUNT : DUST_AMOUNT * BigInt(2)),
    tokens: [{ id: localTokenId, amount: BigInt(1) }]
  })
}

export async function attestFromEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  tokenAddress: string,
  overrides: PayableOverrides & { from?: string | Promise<string> } = {}
): Promise<ethers.ContractTransaction> {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  return await bridge.attestToken(tokenAddress, createNonce(), overrides);
}

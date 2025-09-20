import { ALPH_TOKEN_ID, binToHex, DUST_AMOUNT, ExecuteScriptResult, SignerProvider } from "@alephium/web3";
import { ethers, Overrides } from "ethers";
import { Bridge__factory } from "../ethers-contracts";
import { CreateRemoteTokenPool, CreateLocalTokenPool } from "../alephium-contracts/ts/scripts";

export async function createRemoteTokenPoolOnAlph(
  signerProvider: SignerProvider,
  attestTokenHandlerId: string,
  signedVAA: Uint8Array,
  payer: string,
  alphAmount: bigint
): Promise<ExecuteScriptResult> {
  return CreateRemoteTokenPool.execute({
    signer: signerProvider,
    initialFields: {
      payer: payer,
      attestTokenHandler: attestTokenHandlerId,
      vaa: binToHex(signedVAA),
      alphAmount: alphAmount
    },
    attoAlphAmount: alphAmount
  })
}

export async function createLocalTokenPoolOnAlph(
  signerProvider: SignerProvider,
  attestTokenHandlerId: string,
  localTokenId: string,
  signedVAA: Uint8Array,
  payer: string,
  alphAmount: bigint
): Promise<ExecuteScriptResult> {
  return CreateLocalTokenPool.execute({
    signer: signerProvider,
    initialFields: {
      payer: payer,
      attestTokenHandler: attestTokenHandlerId,
      localTokenId: localTokenId,
      vaa: binToHex(signedVAA),
      alphAmount: alphAmount
    },
    attoAlphAmount: alphAmount + (localTokenId === ALPH_TOKEN_ID ? DUST_AMOUNT : DUST_AMOUNT * BigInt(2)),
    tokens: [{ id: localTokenId, amount: BigInt(1) }]
  })
}

export async function createWrappedOnEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  signedVAA: Uint8Array,
  overrides: Overrides & { from?: string | Promise<string> } = {}
): Promise<ethers.ContractTransaction> {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  return await bridge.createWrapped(signedVAA, overrides);
}

import { ALPH_TOKEN_ID, codec, DUST_AMOUNT, ExecuteScriptResult, groupOfLockupScript, SignerProvider } from "@alephium/web3";
import { ethers, Overrides, PayableOverrides } from "ethers";
import { TransferLocal, TransferRemote } from "../alephium-contracts/ts/scripts";
import {
  Bridge__factory,
  TokenImplementation__factory,
} from "../ethers-contracts";
import {
  ChainId,
  ChainName,
  CHAIN_ID_ALEPHIUM,
  coalesceChainId,
  createNonce,
  hexToUint8Array,
  textToUint8Array
} from "../utils";
import { safeBigIntToNumber } from "../utils/bigint";
import base58 from "bs58";

const ALEPHIUM_CONTRACT_GROUP: number = 0

export async function transferLocalTokenFromAlph(
  signerProvider: SignerProvider,
  tokenBridgeId: string,
  fromAddress: string,
  localTokenId: string,
  toChainId: ChainId,
  toAddress: string,
  tokenAmount: bigint,
  messageFee: bigint,
  arbiterFee: bigint,
  consistencyLevel: number,
  nonce?: string
): Promise<ExecuteScriptResult> {
  const nonceHex = (typeof nonce !== "undefined") ? nonce : createNonce().toString('hex')
  return TransferLocal.execute({
    signer: signerProvider,
    initialFields: {
      tokenBridge: tokenBridgeId,
      fromAddress: fromAddress,
      localTokenId: localTokenId,
      alphChainId: BigInt(CHAIN_ID_ALEPHIUM),
      toChainId: BigInt(toChainId),
      toAddress: toAddress,
      tokenAmount: tokenAmount,
      arbiterFee: arbiterFee,
      nonce: nonceHex,
      consistencyLevel: BigInt(consistencyLevel)
    },
    attoAlphAmount: localTokenId === ALPH_TOKEN_ID ? messageFee + tokenAmount : messageFee,
    tokens: localTokenId === ALPH_TOKEN_ID
      ? []
      : [{ id: localTokenId, amount: tokenAmount }, { id: ALPH_TOKEN_ID, amount: DUST_AMOUNT * BigInt(2) }]
  })
}

export async function transferRemoteTokenFromAlph(
  signerProvider: SignerProvider,
  tokenBridgeId: string,
  fromAddress: string,
  tokenPoolId: string,
  remoteTokenId: string,
  tokenChainId: ChainId,
  toChainId: ChainId,
  toAddress: string,
  tokenAmount: bigint,
  messageFee: bigint,
  arbiterFee: bigint,
  consistencyLevel: number,
  nonce?: string
): Promise<ExecuteScriptResult> {
  const nonceHex = (typeof nonce !== "undefined") ? nonce : createNonce().toString('hex')
  return TransferRemote.execute({
    signer: signerProvider,
    initialFields: {
      tokenBridge: tokenBridgeId,
      fromAddress: fromAddress,
      tokenPoolId: tokenPoolId,
      remoteTokenId: remoteTokenId,
      tokenChainId: BigInt(tokenChainId),
      toChainId: BigInt(toChainId),
      toAddress: toAddress,
      tokenAmount: tokenAmount,
      arbiterFee: arbiterFee,
      nonce: nonceHex,
      consistencyLevel: BigInt(consistencyLevel)
    },
    attoAlphAmount: messageFee,
    tokens: [{ id: tokenPoolId, amount: tokenAmount }, { id: ALPH_TOKEN_ID, amount: DUST_AMOUNT * BigInt(2) }]
  })
}

export async function getAllowanceEth(
  tokenBridgeAddress: string,
  tokenAddress: string,
  signer: ethers.Signer
) {
  const token = TokenImplementation__factory.connect(tokenAddress, signer);
  const signerAddress = await signer.getAddress();
  const allowance = await token.allowance(signerAddress, tokenBridgeAddress);

  return allowance;
}

export async function approveEth(
  tokenBridgeAddress: string,
  tokenAddress: string,
  signer: ethers.Signer,
  amount: ethers.BigNumberish,
  overrides: Overrides & { from?: string | Promise<string> } = {}
) {
  const token = TokenImplementation__factory.connect(tokenAddress, signer);
  return await token.approve(tokenBridgeAddress, amount, overrides)
}

export function checkRecipientAddress(recipientChain: ChainId, recipientAddress: Uint8Array) {
  if (recipientChain !== CHAIN_ID_ALEPHIUM) return

  const lockupScript = codec.lockupScript.lockupScriptCodec.decode(recipientAddress)
  if (groupOfLockupScript(lockupScript) !== ALEPHIUM_CONTRACT_GROUP) {
    throw new Error(`invalid recipient address for alephium`)
  }
}

export async function transferFromEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  tokenAddress: string,
  amount: ethers.BigNumberish,
  recipientChain: ChainId | ChainName,
  recipientAddress: Uint8Array,
  relayerFee: ethers.BigNumberish = 0,
  overrides: PayableOverrides & { from?: string | Promise<string> } = {}
) {
  const recipientChainId = coalesceChainId(recipientChain);
  checkRecipientAddress(recipientChainId, recipientAddress);
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  return await bridge.transferTokens(
    tokenAddress,
    amount,
    recipientChainId,
    recipientAddress,
    relayerFee,
    createNonce(),
    overrides
  );
}

export async function transferFromEthNative(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  amount: ethers.BigNumberish,
  recipientChain: ChainId | ChainId,
  recipientAddress: Uint8Array,
  relayerFee: ethers.BigNumberish = 0,
  overrides: PayableOverrides & { from?: string | Promise<string> } = {}
) {
  const recipientChainId = coalesceChainId(recipientChain);
  checkRecipientAddress(recipientChainId, recipientAddress);
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  return await bridge.wrapAndTransferETH(
    recipientChainId,
    recipientAddress,
    relayerFee,
    createNonce(),
    {
      ...overrides,
      value: amount,
    }
  );
}

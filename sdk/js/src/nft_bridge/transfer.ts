import { BN } from "@project-serum/anchor";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { MsgExecuteContract } from "@terra-money/terra.js";
import { ethers, Overrides } from "ethers";
import {
  NFTBridge__factory,
  NFTImplementation__factory,
} from "../ethers-contracts";
import { ChainId, ChainName, CHAIN_ID_SOLANA, coalesceChainId, createNonce } from "../utils";
import { createBridgeFeeTransferInstruction } from "../solana";
import {
  createApproveAuthoritySignerInstruction,
  createTransferNativeInstruction,
  createTransferWrappedInstruction
} from "../solana/nftBridge";

export async function transferFromEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  tokenAddress: string,
  tokenID: ethers.BigNumberish,
  recipientChain: ChainId | ChainName,
  recipientAddress: Uint8Array,
  overrides: Overrides & { from?: string | Promise<string> } = {}
): Promise<ethers.ContractReceipt> {
  const recipientChainId = coalesceChainId(recipientChain)
  //TODO: should we check if token attestation exists on the target chain
  const token = NFTImplementation__factory.connect(tokenAddress, signer);
  await (await token.approve(tokenBridgeAddress, tokenID, overrides)).wait();
  const bridge = NFTBridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.transferNFT(
    tokenAddress,
    tokenID,
    recipientChainId,
    recipientAddress,
    createNonce(),
    overrides
  );
  const receipt = await v.wait();
  return receipt;
}

export async function transferFromSolana(
  connection: Connection,
  bridgeAddress: string,
  nftBridgeAddress: string,
  payerAddress: string,
  fromAddress: string,
  mintAddress: string,
  targetAddress: Uint8Array,
  targetChain: ChainId | ChainName,
  originAddress?: Uint8Array,
  originChain?: ChainId | ChainName,
  originTokenId?: Uint8Array
): Promise<Transaction> {
  const originChainId: ChainId | undefined = originChain
    ? coalesceChainId(originChain)
    : undefined;
  const nonce = createNonce().readUInt32LE(0);
  const transferIx = await createBridgeFeeTransferInstruction(
    connection,
    bridgeAddress,
    payerAddress
  );
  const approvalIx = createApproveAuthoritySignerInstruction(
    nftBridgeAddress,
    fromAddress,
    payerAddress
  );
  let message = Keypair.generate();
  const isSolanaNative =
    originChain === undefined || originChain === CHAIN_ID_SOLANA;
  if (!isSolanaNative && (!originAddress || !originTokenId)) {
    return Promise.reject(
      "originAddress and originTokenId are required when specifying originChain"
    );
  }
  const nftBridgeTransferIx = isSolanaNative
    ? createTransferNativeInstruction(
        nftBridgeAddress,
        bridgeAddress,
        payerAddress,
        message.publicKey,
        fromAddress,
        mintAddress,
        nonce,
        targetAddress,
        coalesceChainId(targetChain)
      )
    : createTransferWrappedInstruction(
        nftBridgeAddress,
        bridgeAddress,
        payerAddress,
        message.publicKey,
        fromAddress,
        payerAddress,
        originChainId!,
        originAddress!,
        BigInt(new BN(originTokenId!).toString()),
        nonce,
        targetAddress,
        coalesceChainId(targetChain)
      );
  const transaction = new Transaction().add(
    transferIx,
    approvalIx,
    nftBridgeTransferIx
  );
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = new PublicKey(payerAddress);
  transaction.partialSign(message);
  return transaction;
}

export async function transferFromTerra(
  walletAddress: string,
  tokenBridgeAddress: string,
  tokenAddress: string,
  tokenID: string,
  recipientChain: ChainId | ChainName,
  recipientAddress: Uint8Array
): Promise<MsgExecuteContract[]> {
  const recipientChainId = coalesceChainId(recipientChain)
  const nonce = Math.round(Math.random() * 100000);
  return [
    new MsgExecuteContract(
      walletAddress,
      tokenAddress,
      {
        approve: {
          spender: tokenBridgeAddress,
          token_id: tokenID,
        },
      },
      {}
    ),
    new MsgExecuteContract(
      walletAddress,
      tokenBridgeAddress,
      {
        initiate_transfer: {
          contract_addr: tokenAddress,
          token_id: tokenID,
          recipient_chain: recipientChainId,
          recipient: Buffer.from(recipientAddress).toString("base64"),
          nonce: nonce,
        },
      },
      {}
    ),
  ];
}

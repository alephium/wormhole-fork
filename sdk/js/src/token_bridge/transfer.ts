import { MsgExecuteContract } from "@terra-money/terra.js";
import { ethers, Overrides, PayableOverrides } from "ethers";
import { isNativeDenom } from "..";
import { transferLocalTokenScript, transferRemoteTokenScript } from "../alephium/token_bridge";
import {
  Bridge__factory,
  TokenImplementation__factory,
} from "../ethers-contracts";
import { ChainId, createNonce } from "../utils";

export function transferLocalTokenFromAlph(
  tokenWrapperId: string,
  sender: string,
  localTokenId: string,
  toAddress: string,
  tokenAmount: bigint,
  messageFee: bigint,
  arbiterFee: bigint,
  consistencyLevel?: number,
  nonce?: string
): string {
  const nonceHex = (typeof nonce !== "undefined") ? nonce : createNonce().toString('hex')
  const cl = (typeof consistencyLevel !== "undefined") ? consistencyLevel : 10
  const script = transferLocalTokenScript()
  return script.buildByteCodeToDeploy({
    sender: sender,
    tokenWrapperId: tokenWrapperId,
    localTokenId: localTokenId,
    toAddress: toAddress,
    tokenAmount: tokenAmount,
    messageFee: messageFee,
    arbiterFee: arbiterFee,
    nonce: nonceHex,
    consistencyLevel: cl
  })
}

export function transferRemoteTokenFromAlph(
  tokenWrapperId: string,
  sender: string,
  toAddress: string,
  tokenAmount: bigint,
  messageFee: bigint,
  arbiterFee: bigint,
  consistencyLevel?: number,
  nonce?: string
): string {
  const nonceHex = (typeof nonce !== "undefined") ? nonce : createNonce().toString('hex')
  const cl = (typeof consistencyLevel !== "undefined") ? consistencyLevel : 10
  const script = transferRemoteTokenScript()
  return script.buildByteCodeToDeploy({
    sender: sender,
    tokenWrapperId: tokenWrapperId,
    toAddress: toAddress,
    tokenAmount: tokenAmount,
    messageFee: messageFee,
    arbiterFee: arbiterFee,
    nonce: nonceHex,
    consistencyLevel: cl
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
  return await (
    await token.approve(tokenBridgeAddress, amount, overrides)
  ).wait();
}

export async function transferFromEth(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  tokenAddress: string,
  amount: ethers.BigNumberish,
  recipientChain: ChainId,
  recipientAddress: Uint8Array,
  relayerFee: ethers.BigNumberish = 0,
  overrides: PayableOverrides & { from?: string | Promise<string> } = {}
) {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.transferTokens(
    tokenAddress,
    amount,
    recipientChain,
    recipientAddress,
    relayerFee,
    createNonce(),
    overrides
  );
  const receipt = await v.wait();
  return receipt;
}

export async function transferFromEthNative(
  tokenBridgeAddress: string,
  signer: ethers.Signer,
  amount: ethers.BigNumberish,
  recipientChain: ChainId,
  recipientAddress: Uint8Array,
  relayerFee: ethers.BigNumberish = 0,
  overrides: PayableOverrides & { from?: string | Promise<string> } = {}
) {
  const bridge = Bridge__factory.connect(tokenBridgeAddress, signer);
  const v = await bridge.wrapAndTransferETH(
    recipientChain,
    recipientAddress,
    relayerFee,
    createNonce(),
    {
      ...overrides,
      value: amount,
    }
  );
  const receipt = await v.wait();
  return receipt;
}

export async function transferFromTerra(
  walletAddress: string,
  tokenBridgeAddress: string,
  tokenAddress: string,
  amount: string,
  recipientChain: ChainId,
  recipientAddress: Uint8Array,
  relayerFee: string = "0"
) {
  const nonce = Math.round(Math.random() * 100000);
  const isNativeAsset = isNativeDenom(tokenAddress);
  return isNativeAsset
    ? [
        new MsgExecuteContract(
          walletAddress,
          tokenBridgeAddress,
          {
            deposit_tokens: {},
          },
          { [tokenAddress]: amount }
        ),
        new MsgExecuteContract(
          walletAddress,
          tokenBridgeAddress,
          {
            initiate_transfer: {
              asset: {
                amount,
                info: {
                  native_token: {
                    denom: tokenAddress,
                  },
                },
              },
              recipient_chain: recipientChain,
              recipient: Buffer.from(recipientAddress).toString("base64"),
              fee: relayerFee,
              nonce: nonce,
            },
          },
          {}
        ),
      ]
    : [
        new MsgExecuteContract(
          walletAddress,
          tokenAddress,
          {
            increase_allowance: {
              spender: tokenBridgeAddress,
              amount: amount,
              expires: {
                never: {},
              },
            },
          },
          {}
        ),
        new MsgExecuteContract(
          walletAddress,
          tokenBridgeAddress,
          {
            initiate_transfer: {
              asset: {
                amount: amount,
                info: {
                  token: {
                    contract_addr: tokenAddress,
                  },
                },
              },
              recipient_chain: recipientChain,
              recipient: Buffer.from(recipientAddress).toString("base64"),
              fee: relayerFee,
              nonce: nonce,
            },
          },
          {}
        ),
      ];
}

import { BigNumber } from "@ethersproject/bignumber";
import { MintLayout } from "@solana/spl-token";
import { WalletContextState } from "@solana/wallet-adapter-react";
import {
  AccountInfo,
  Connection,
  PublicKey,
  Transaction,
} from "@solana/web3.js";

export async function signSendAndConfirm(
  wallet: WalletContextState,
  connection: Connection,
  transaction: Transaction
) {
  if (!wallet.signTransaction) {
    throw new Error("wallet.signTransaction is undefined");
  }
  const signed = await wallet.signTransaction(transaction);
  const txid = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(txid);
  return txid;
}

export interface ExtractedMintInfo {
  mintAuthority?: string;
  supply?: string;
}

export function extractMintInfo(
  account: AccountInfo<Buffer>
): ExtractedMintInfo {
  const data = Buffer.from(account.data);
  const mintInfo = MintLayout.decode(data);

  const uintArray = mintInfo?.mintAuthority;
  const pubkey = new PublicKey(uintArray);
  const supply = BigNumber.from(mintInfo?.supply.reverse()).toString();
  const output = {
    mintAuthority: pubkey?.toString(),
    supply: supply.toString(),
  };

  return output;
}

export async function getMultipleAccountsRPC(
  connection: Connection,
  pubkeys: PublicKey[]
): Promise<(AccountInfo<Buffer> | null)[]> {
  return getMultipleAccounts(connection, pubkeys, "confirmed");
}

export const getMultipleAccounts = async (
  connection: any,
  pubkeys: PublicKey[],
  commitment: string
) => {
  return (
    await Promise.all(
      chunks(pubkeys, 99).map((chunk) =>
        connection.getMultipleAccountsInfo(chunk, commitment)
      )
    )
  ).flat();
};

export function chunks<T>(array: T[], size: number): T[][] {
  return Array.apply<number, T[], T[][]>(
    0,
    new Array(Math.ceil(array.length / size))
  ).map((_, index) => array.slice(index * size, (index + 1) * size));
}


interface TokenExtensions {
  readonly website?: string;
  readonly bridgeContract?: string;
  readonly assetContract?: string;
  readonly address?: string;
  readonly explorer?: string;
  readonly twitter?: string;
  readonly github?: string;
  readonly medium?: string;
  readonly tgann?: string;
  readonly tggroup?: string;
  readonly discord?: string;
  readonly serumV3Usdt?: string;
  readonly serumV3Usdc?: string;
  readonly coingeckoId?: string;
  readonly imageUrl?: string;
  readonly description?: string;
}

export interface TokenInfo {
  readonly chainId: number;
  readonly address: string;
  readonly name: string;
  readonly decimals: number;
  readonly symbol: string;
  readonly logoURI?: string;
  readonly tags?: string[];
  readonly extensions?: TokenExtensions;
}

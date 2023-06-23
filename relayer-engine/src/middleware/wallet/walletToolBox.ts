import * as wh from "@alephium/wormhole-sdk";
import { ethers } from "ethers";
import { Providers } from "../providers.middleware";
import { EVMWallet, Wallet, AlephiumWallet } from "./wallet.middleware";
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { CHAIN_ID_ALEPHIUM, coalesceChainName } from "@alephium/wormhole-sdk";

export interface WalletToolBox<T extends Wallet> extends Providers {
  wallet: T;
  getBalance(): Promise<string>;
  address: string;
}

export async function createWalletToolbox(
  providers: Providers,
  privateKey: string,
  chainId: wh.ChainId,
): Promise<WalletToolBox<any>> {
  if (wh.isEVMChain(chainId)) {
    return createEVMWalletToolBox(providers, privateKey, chainId);
  }
  if (chainId === CHAIN_ID_ALEPHIUM) {
    return createAlephiumWalletToolBox(providers, privateKey)
  }
  throw new Error(`Unknown chain: ${coalesceChainName(chainId)}`)
}

function createEVMWalletToolBox(
  providers: Providers,
  privateKey: string,
  chainId: wh.EVMChainId,
): WalletToolBox<EVMWallet> {
  const wallet = new ethers.Wallet(privateKey, providers.evm[chainId][0]);
  return {
    ...providers,
    wallet: wallet,
    async getBalance(): Promise<string> {
      const b = await wallet.getBalance();
      return b.toString();
    },
    address: wallet.address,
  };
}

function createAlephiumWalletToolBox(
  providers: Providers,
  privateKey: string
): WalletToolBox<AlephiumWallet> {
  const nodeProvider = providers.alephium[0]
  const wallet = new PrivateKeyWallet({ privateKey, nodeProvider })
  const getBalance = async (): Promise<string> => {
    const balance = await nodeProvider.addresses.getAddressesAddressBalance(wallet.address)
    const available = BigInt(balance.balance) - BigInt(balance.lockedBalance)
    return available.toString()
  }
  return {...providers, wallet, getBalance, address: wallet.address }
}

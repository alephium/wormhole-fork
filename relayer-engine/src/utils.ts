import * as wormholeSdk from "@alephium/wormhole-sdk";
import { ParsedVaaWithBytes } from "./application";
import { ethers } from "ethers";
import { map } from "bluebird";
import {
  ChainId,
  EVMChainId,
  isChain,
  isEVMChain,
  deserializeVAA,
  uint8ArrayToHex,
  CHAIN_ID_ETH,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_BSC,
  coalesceChainName
} from "@alephium/wormhole-sdk";
import { default as devnetAlephiumConfig } from "../../configs/alephium/devnet.json"
import { default as testnetAlephiumConfig } from "../../configs/alephium/testnet.json"
import { default as mainnetAlephiumConfig } from "../../configs/alephium/mainnet.json"
import { default as devnetEthereumConfig } from "../../configs/ethereum/devnet.json"
import { default as testnetEthereumConfig } from "../../configs/ethereum/testnet.json"
import { default as mainnetEthereumConfig } from "../../configs/ethereum/mainnet.json"
import { default as devnetBscConfig } from "../../configs/bsc/devnet.json"
import { default as testnetBscConfig } from "../../configs/bsc/testnet.json"
import { default as mainnetBscConfig } from "../../configs/bsc/mainnet.json"
import { groupOfAddress, NetworkId } from "@alephium/web3";

export const SUPPORTED_CHAINS = [CHAIN_ID_ETH, CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC]

export function encodeEmitterAddress(
  chainId: wormholeSdk.ChainId,
  emitterAddressStr: string,
): string {
  if (wormholeSdk.isEVMChain(chainId)) {
    return wormholeSdk.getEmitterAddressEth(emitterAddressStr);
  }
  if (wormholeSdk.CHAIN_ID_ALEPHIUM === chainId) {
    return emitterAddressStr
  }

  throw new Error(`Unrecognized wormhole chainId ${chainId}`);
}

export const strip0x = (str: string) =>
  str.startsWith("0x") ? str.substring(2) : str;

export function sleep(ms: number) {
  return new Promise((resolve, reject) => setTimeout(resolve, ms));
}

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
export function isObject(item: any) {
  return item && typeof item === "object" && !Array.isArray(item);
}

export function parseVaaWithBytes(bytes: Uint8Array): ParsedVaaWithBytes {
  const parsed = deserializeVAA(bytes)
  const id = {
    emitterChain: parsed.body.emitterChainId,
    emitterAddress: uint8ArrayToHex(parsed.body.emitterAddress),
    targetChain: parsed.body.targetChainId,
    sequence: parsed.body.sequence.toString()
  };
  return { id, bytes, parsed };
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
export function mergeDeep<T>(
  target: Partial<T>,
  sources: Partial<T>[],
  maxDepth = 10,
): T {
  if (!sources.length || maxDepth === 0) {
    // @ts-ignore
    return target;
  }
  const source = sources.shift();

  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], [source[key]], maxDepth - 1);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, sources, maxDepth);
}

export const second = 1000;
export const minute = 60 * second;
export const hour = 60 * minute;

export class EngineError extends Error {
  constructor(msg: string, public args?: Record<any, any>) {
    super(msg);
  }
}

export function maybeConcat<T>(...arrs: (T[] | undefined)[]): T[] {
  return arrs.flatMap(arr => (arr ? arr : []));
}

export function nnull<T>(x: T | undefined | null, errMsg?: string): T {
  if (x === undefined || x === null) {
    throw new Error("Found unexpected undefined or null. " + errMsg);
  }
  return x;
}

export function assertStr(x: any, fieldName?: string): string {
  if (typeof x !== "string") {
    throw new EngineError(`Expected field to be integer, found ${x}`, {
      fieldName,
    }) as any;
  }
  return x as string;
}

export function assertInt(x: any, fieldName?: string): number {
  if (!Number.isInteger(Number(x))) {
    throw new EngineError(`Expected field to be integer, found ${x}`, {
      fieldName,
    }) as any;
  }
  return x as number;
}

export function assertArray<T>(
  x: any,
  name: string,
  elemsPred?: (x: any) => boolean,
): T[] {
  if (!Array.isArray(x) || (elemsPred && !x.every(elemsPred))) {
    throw new EngineError(`Expected value to be array, found ${x}`, {
      name,
    }) as any;
  }
  return x as T[];
}

export function assertBool(x: any, fieldName?: string): boolean {
  if (x !== false && x !== true) {
    throw new EngineError(`Expected field to be boolean, found ${x}`, {
      fieldName,
    }) as any;
  }
  return x as boolean;
}

export function wormholeBytesToHex(address: Buffer | Uint8Array): string {
  return ethers.utils.hexlify(address).replace("0x", "");
}

export function assertEvmChainId(chainId: number): EVMChainId {
  if (!isEVMChain(chainId as ChainId)) {
    throw new EngineError("Expected number to be valid EVM chainId", {
      chainId,
    });
  }
  return chainId as EVMChainId;
}

export function assertChainId(chainId: number): ChainId {
  if (!isChain(chainId)) {
    throw new EngineError("Expected number to be valid chainId", { chainId });
  }
  return chainId as ChainId;
}

export function dbg<T>(x: T, msg?: string): T {
  if (msg) {
    console.log(msg);
  }
  console.log(x);
  return x;
}

export function mapConcurrent(
  arr: any[],
  fn: (...args: any[]) => any,
  concurrency: number = 5,
) {
  return map(arr, fn, { concurrency });
}

type chainConfig = {
  contracts: {
    tokenBridge: string
    governance: string
    bridgeRewardRouter?: string
    wrappedNative?: string
  },
  nodeUrl: string
  groupIndex?: number
}

const chainConfigs: Partial<{ [k in ChainId]: { [n in NetworkId]: chainConfig } }> = {
  [CHAIN_ID_ALEPHIUM]: {
    'mainnet': mainnetAlephiumConfig,
    'testnet': testnetAlephiumConfig,
    'devnet': devnetAlephiumConfig
  },
  [CHAIN_ID_ETH]: {
    'mainnet': mainnetEthereumConfig,
    'testnet': testnetEthereumConfig,
    'devnet': devnetEthereumConfig
  },
  [CHAIN_ID_BSC]: {
    'mainnet': mainnetBscConfig,
    'testnet': testnetBscConfig,
    'devnet': devnetBscConfig,
  }
}

export function getTokenBridgeAddress(network: NetworkId, chainId: ChainId): string {
  try {
    return chainConfigs[chainId][network].contracts.tokenBridge
  } catch (_) {
    throw new Error(`Failed to get token bridge address for ${coalesceChainName(chainId)}, network: ${network}`)
  }
}

export function getGovernanceAddress(network: NetworkId, chainId: ChainId): string {
  try {
    return chainConfigs[chainId][network].contracts.governance
  } catch (_) {
    throw new Error(`Failed to get governance address for ${coalesceChainName(chainId)}, network: ${network}`)
  }
}

export function getNodeUrl(network: NetworkId, chainId: ChainId): string {
  try {
    const chainName = coalesceChainName(chainId).toUpperCase()
    return process.env[`${chainName}_NODE_URL`] ?? chainConfigs[chainId][network].nodeUrl
  } catch (_) {
    throw new Error(`Failed to get node url for ${coalesceChainName(chainId)}, network: ${network}`)
  }
}

export function getBridgeRewardRouterId(network: NetworkId, chainId: ChainId): string {
  if (chainId !== CHAIN_ID_ALEPHIUM) {
    throw new Error('Only Alephium supports rewards')
  }
  const bridgeRewardRouterId = chainConfigs[chainId][network]?.contracts.bridgeRewardRouter
  if (bridgeRewardRouterId === undefined) {
    throw new Error('The BridgeRewardRouter contract does not exist')
  }
  return bridgeRewardRouterId
}

export function getAlephiumGroupIndex(network: NetworkId): number {
  const groupIndex = chainConfigs[CHAIN_ID_ALEPHIUM][network]?.groupIndex
  if (groupIndex === undefined) {
    const contractAddress = getTokenBridgeAddress(network, CHAIN_ID_ALEPHIUM)
    return groupOfAddress(contractAddress)
  }
  return groupIndex
}

export function getWrappedNativeAddress(network: NetworkId, chainId: ChainId): string {
  if (!isEVMChain(chainId)) {
    throw new Error(`There is no wrapped native contract for non evm chain`)
  }
  const wrappedNative = chainConfigs[chainId][network]?.contracts.wrappedNative
  if (wrappedNative === undefined) {
    throw new Error(`There is no wrapped native contract for ${coalesceChainName(chainId)}`)
  }
  return wrappedNative
}

export function newEVMProvider(url: string): ethers.providers.Provider {
  if (url.startsWith('http')) {
    return new ethers.providers.JsonRpcProvider(url)
  }
  const index = url.indexOf('://')
  const rpcUrl = index === -1 ? 'http://' + url : 'http' + url.slice(index)
  return new ethers.providers.JsonRpcProvider(rpcUrl)
}

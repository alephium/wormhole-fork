import { networkIds, NetworkId, NodeProvider, web3 } from "@alephium/web3";
import { ChainId, CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC, CHAIN_ID_ETH } from "alephium-wormhole-sdk";
import { getLogger } from "./helpers/logHelper";
import * as alephiumDevnetConfig from '../../../configs/alephium/devnet.json'
import * as alephiumTestnetConfig from '../../../configs/alephium/testnet.json'
import * as alephiumMainnetConfig from '../../../configs/alephium/mainnet.json'
import * as ethereumDevnetConfig from '../../../configs/ethereum/devnet.json'
import * as ethereumTestnetConfig from '../../../configs/ethereum/testnet.json'
import * as ethereumMainnetConfig from '../../../configs/ethereum/mainnet.json'
import * as bscDevnetConfig from '../../../configs/bsc/devnet.json'
import * as bscTestnetConfig from '../../../configs/bsc/testnet.json'
import * as bscMainnetConfig from '../../../configs/bsc/mainnet.json'

export type SupportedToken = {
  chainId: ChainId;
  address: string;
  minimalFee: bigint;
};

export type CommonEnvironment = {
  logLevel: string;
  promPort: number;
  readinessPort?: number;
  logDir?: string;
  redisHost: string;
  redisPort: number;
};

function validateNetwork() {
  if (process.env.NETWORK === undefined) {
    throw new Error(`Missing NETWORK in config`)
  }
  if (networkIds.find((n) => n === process.env.NETWORK) === undefined) {
    throw new Error(`Network has to be one of ${networkIds}`)
  }
}

let loggingEnv: CommonEnvironment | undefined = undefined;

export const getCommonEnvironment: () => CommonEnvironment = () => {
  if (loggingEnv) {
    return loggingEnv;
  } else {
    const env = createCommonEnvironment();
    loggingEnv = env;
    return loggingEnv;
  }
};

function createCommonEnvironment(): CommonEnvironment {
  validateNetwork()

  let logLevel;
  let promPort;
  let readinessPort;
  let logDir;
  let redisHost;
  let redisPort;

  if (!process.env.LOG_LEVEL) {
    throw new Error("Missing required environment variable: LOG_LEVEL");
  } else {
    logLevel = process.env.LOG_LEVEL;
  }

  if (!process.env.LOG_DIR) {
    //Not mandatory
  } else {
    logDir = process.env.LOG_DIR;
  }

  if (!process.env.PROM_PORT) {
    throw new Error("Missing required environment variable: PROM_PORT");
  } else {
    promPort = parseInt(process.env.PROM_PORT);
  }

  if (!process.env.READINESS_PORT) {
    //do nothing
  } else {
    readinessPort = parseInt(process.env.READINESS_PORT);
  }

  if (!process.env.REDIS_HOST) {
    throw new Error("Missing required environment variable: REDIS_HOST");
  } else {
    redisHost = process.env.REDIS_HOST;
  }

  if (!process.env.REDIS_PORT) {
    throw new Error("Missing required environment variable: REDIS_PORT");
  } else {
    redisPort = parseInt(process.env.REDIS_PORT);
  }

  return { logLevel, promPort, readinessPort, logDir, redisHost, redisPort };
}

export type RelayerEnvironment = {
  supportedChains: ChainConfigInfo[];
  redisHost: string;
  redisPort: number;
  clearRedisOnInit: boolean;
  demoteWorkingOnInit: boolean;
  supportedTokens: SupportedToken[];
};

export type WalletMonitorEnvironment = {
  supportedChains: ChainConfigInfo[]
  supportedTokens: SupportedToken[]
}

export interface ChainConfigInfo {
  chainId: ChainId
  nativeCurrencySymbol: string
  nodeUrl: string
  tokenBridgeAddress: string
  walletPrivateKeys?: string[]
  walletAddresses?: string[]
}

export interface EvmChainConfigInfo extends ChainConfigInfo {
  chainName: string
  coreBridgeAddress: string
  wrappedNativeAsset: string
}

export interface TerraChainConfigInfo extends ChainConfigInfo {
  terraName: string
  terraChainId: string
  terraCoin: string
  terraGasPriceUrl: string
}

export interface AlephiumChainConfigInfo extends ChainConfigInfo {
  groupIndex: number
  bridgeRewardRouter: string
}

let walletMonitorEnv: WalletMonitorEnvironment | undefined = undefined

export const getWalletMonitorEnvironment: () => WalletMonitorEnvironment = () => {
  if (walletMonitorEnv) {
    return walletMonitorEnv
  }
  const env = createWalletMonitorEnv()
  walletMonitorEnv = env
  return walletMonitorEnv
}

const createWalletMonitorEnv: () => WalletMonitorEnvironment = () => {
  const supportedChains = loadChainConfig('WALLET_MONITOR_CHAINS', false)
  const supportedTokens = loadSupportedTokens()
  return {
    supportedChains,
    supportedTokens
  }
}

export type ListenerEnvironment = {
  spyServiceHost: string;
  spyServiceFilters: { chainId: ChainId; emitterAddress: string }[];
  restPort: number;
  supportedTokens: SupportedToken[];
};

let listenerEnv: ListenerEnvironment | undefined = undefined;

export const getListenerEnvironment: () => ListenerEnvironment = () => {
  if (listenerEnv) {
    return listenerEnv;
  } else {
    const env = createListenerEnvironment();
    listenerEnv = env;
    return listenerEnv;
  }
};

const createListenerEnvironment: () => ListenerEnvironment = () => {
  let spyServiceHost: string;
  let spyServiceFilters: { chainId: ChainId; emitterAddress: string }[] = [];
  let restPort: number;
  const logger = getLogger();

  if (!process.env.SPY_SERVICE_HOST) {
    throw new Error("Missing required environment variable: SPY_SERVICE_HOST");
  } else {
    spyServiceHost = process.env.SPY_SERVICE_HOST;
  }

  logger.info("Getting SPY_SERVICE_FILTER_CHAINS...");
  if (!process.env.SPY_SERVICE_FILTER_CHAINS) {
    throw new Error(
      "Missing required environment variable: SPY_SERVICE_FILTER_CHAINS"
    );
  }
  const chains = JSON.parse(process.env.SPY_SERVICE_FILTER_CHAINS);
  if (!chains || !Array.isArray(chains)) {
    throw new Error('Spy service filter chains is not an array.');
  }
  chains.forEach((chain: any) => {
    if (typeof chain !== 'number') {
      throw new Error(`Invalid filter chain: ${chain}`);
    }
    const chainId = chain as ChainId
    spyServiceFilters.push({
      chainId: chainId,
      emitterAddress: getTokenBridgeAddress(chainId),
    })
  })

  logger.info("Getting REST_PORT...");
  if (!process.env.REST_PORT) {
    throw new Error("Missing required environment variable: REST_PORT");
  } else {
    restPort = parseInt(process.env.REST_PORT);
  }

  logger.info("Getting SUPPORTED_TOKENS...");
  const supportedTokens = loadSupportedTokens() 

  return {
    spyServiceHost,
    spyServiceFilters,
    restPort,
    supportedTokens,
  };
};

interface ChainContracts {
  groupIndex?: number
  contracts: {
    governance: string
    tokenBridge: string
    bridgeRewardRouter?: string
    wrappedNative?: string
  },
  bridgeTokens: string[]
}

const allChains: Map<ChainId, { [key in NetworkId]: ChainContracts }> = new Map([
  [CHAIN_ID_ALEPHIUM, {
    devnet: alephiumDevnetConfig,
    testnet: alephiumTestnetConfig,
    mainnet: alephiumMainnetConfig,
  }],
  [CHAIN_ID_ETH, {
    devnet: ethereumDevnetConfig,
    testnet: ethereumTestnetConfig,
    mainnet: ethereumMainnetConfig,
  }],
  [CHAIN_ID_BSC, {
    devnet: bscDevnetConfig,
    testnet: bscTestnetConfig,
    mainnet: bscMainnetConfig,
  }]
])

function getChainContractsByChainId(chainId: ChainId): ChainContracts {
  const chain = allChains.get(chainId)
  if (chain === undefined) {
    throw new Error(`Invalid chain id: ${chainId}`)
  }
  return chain[process.env.NETWORK as NetworkId]
}

function getTokenBridgeAddress(chainId: ChainId): string {
  const chainConfig = getChainContractsByChainId(chainId)
  return chainConfig.contracts.tokenBridge
}

function getBridgeTokens(chainId: ChainId, minimalFee: bigint = 0n): SupportedToken[] {
  const chainConfig = getChainContractsByChainId(chainId)
  return chainConfig.bridgeTokens.map((token) => ({ chainId: chainId, address: token, minimalFee: minimalFee }))
}

function getChainContracts(chainId: ChainId) {
  const chainConfig = getChainContractsByChainId(chainId)
  return chainConfig.contracts
}

let relayerEnv: RelayerEnvironment | undefined = undefined;

export const getRelayerEnvironment: () => RelayerEnvironment = () => {
  if (relayerEnv) {
    return relayerEnv;
  } else {
    const env = createRelayerEnvironment();
    relayerEnv = env;
    return relayerEnv;
  }
};

export function getChainConfigInfo(chainId: ChainId) {
  const env = getRelayerEnvironment()
  return env.supportedChains.find((x) => x.chainId === chainId) 
}

export async function validateChainConfig(env: { supportedChains: ChainConfigInfo[] }) {
  const chainConfigInfo = env.supportedChains.find((x) => x.chainId === CHAIN_ID_ALEPHIUM) 
  if (chainConfigInfo === undefined) {
    return
  }
  const alphConfigInfo = chainConfigInfo as AlephiumChainConfigInfo
  const groupIndex = alphConfigInfo.groupIndex
  if (groupIndex === undefined) {
    throw new Error('No group index specified')
  }
  const nodeProvider = new NodeProvider(alphConfigInfo.nodeUrl)
  const chainParams = await nodeProvider.infos.getInfosChainParams()
  if (groupIndex < 0 || groupIndex >= chainParams.groups) {
    throw new Error(`Invalid chain group: ${groupIndex}`)
  }
  web3.setCurrentNodeProvider(nodeProvider)
}

const createRelayerEnvironment: () => RelayerEnvironment = () => {
  let redisHost: string;
  let redisPort: number;
  let clearRedisOnInit: boolean;
  let demoteWorkingOnInit: boolean;

  if (!process.env.REDIS_HOST) {
    throw new Error("Missing required environment variable: REDIS_HOST");
  } else {
    redisHost = process.env.REDIS_HOST;
  }

  if (!process.env.REDIS_PORT) {
    throw new Error("Missing required environment variable: REDIS_PORT");
  } else {
    redisPort = parseInt(process.env.REDIS_PORT);
  }

  if (process.env.CLEAR_REDIS_ON_INIT === undefined) {
    throw new Error(
      "Missing required environment variable: CLEAR_REDIS_ON_INIT"
    );
  } else {
    if (process.env.CLEAR_REDIS_ON_INIT.toLowerCase() === "true") {
      clearRedisOnInit = true;
    } else {
      clearRedisOnInit = false;
    }
  }

  if (process.env.DEMOTE_WORKING_ON_INIT === undefined) {
    throw new Error(
      "Missing required environment variable: DEMOTE_WORKING_ON_INIT"
    );
  } else {
    if (process.env.DEMOTE_WORKING_ON_INIT.toLowerCase() === "true") {
      demoteWorkingOnInit = true;
    } else {
      demoteWorkingOnInit = false;
    }
  }

  const supportedChains = loadChainConfig('RELAYER_CHAINS', true)
  const supportedTokens = loadSupportedTokens()

  return {
    supportedChains,
    redisHost,
    redisPort,
    clearRedisOnInit,
    demoteWorkingOnInit,
    supportedTokens,
  };
};

export function loadSupportedTokens(): SupportedToken[] {
  if (process.env.SUPPORTED_TOKENS) {
    const tokens = eval(process.env.SUPPORTED_TOKENS);
    if (!tokens || !Array.isArray(tokens)) {
      throw new Error("SUPPORTED_TOKENS is not an array.");
    }
    return tokens.map((token: any) => {
      if (token.chainId && token.address && token.minimalFee) {
        return {
          chainId: token.chainId,
          address: token.address,
          minimalFee: BigInt(token.minimalFee)
        }
      } else {
        throw new Error("Invalid token record: " + JSON.stringify(token));
      }
    })
  }

  const alphTokens = getBridgeTokens(CHAIN_ID_ALEPHIUM)
  const ethTokens = getBridgeTokens(CHAIN_ID_ETH)
  const bscTokens = getBridgeTokens(CHAIN_ID_BSC)
  return Array.prototype.concat(alphTokens, ethTokens, bscTokens)
}

export function loadChainConfig(field: string, isRelayer: boolean): ChainConfigInfo[] {
  const chains = process.env[`${field}`]
  if (chains === undefined) {
    throw new Error(`Missing required environment variable: ${field}`);
  }

  const unformattedChains = JSON.parse(chains);
  const supportedChains: ChainConfigInfo[] = [];

  if (!unformattedChains.forEach) {
    throw new Error("SUPPORTED_CHAINS arg was not an array.");
  }

  unformattedChains.forEach((element: any) => {
    if (!element.chainId) {
      throw new Error(`Chain id is not specified in the config: ${element}`);
    }

    switch (element.chainId) {
      case CHAIN_ID_ALEPHIUM:
        supportedChains.push(createAlephiumChainConfig(element, isRelayer))
        break
      case CHAIN_ID_ETH:
      case CHAIN_ID_BSC:
        const contracts = getChainContracts(element.chainId)
        supportedChains.push(createEvmChainConfig(element, isRelayer, contracts))
        break
      default:
        throw new Error(`Invalid chain id: ${element.chainId}`)
    }
  });

  return supportedChains;
}

function createEvmChainConfig(config: any, isRelayer: boolean, contracts: any): EvmChainConfigInfo {
  const chainConfig = createChainConfig(config, isRelayer)
  const chainName = (config.chainName ?? invalidConfigField('chainName')) as string
  const tokenBridgeAddress = contracts.tokenBridge
  const wrappedNativeAsset = contracts.wrappedNative
  const coreBridgeAddress = contracts.governance
  return {
    ...chainConfig,
    tokenBridgeAddress,
    coreBridgeAddress,
    chainName,
    wrappedNativeAsset
  }
}

function createAlephiumChainConfig(config: any, isRelayer: boolean): AlephiumChainConfigInfo {
  const chainConfig = createChainConfig(config, isRelayer)
  const alephiumConfig = getChainContractsByChainId(CHAIN_ID_ALEPHIUM)
  if (alephiumConfig.groupIndex === undefined) {
    throw new Error('No group index specified in the alephium config')
  }
  const groupIndex = alephiumConfig.groupIndex
  const tokenBridgeAddress = alephiumConfig.contracts.tokenBridge
  if (alephiumConfig.contracts.bridgeRewardRouter === undefined) {
    throw new Error('The BridgeRewardRouter contract does not exists')
  }
  return {
    ...chainConfig,
    tokenBridgeAddress,
    groupIndex,
    bridgeRewardRouter: alephiumConfig.contracts.bridgeRewardRouter
  }
}

function createChainConfig(config: any, isRelayer: boolean): Omit<ChainConfigInfo, 'tokenBridgeAddress'> {
  const chainId = (config.chainId ?? invalidConfigField('chainId')) as ChainId
  const nativeCurrencySymbol = (config.nativeCurrencySymbol ?? invalidConfigField('nativeCurrencySymbol')) as string
  const nodeUrl = (config.nodeUrl ?? invalidConfigField('nodeUrl')) as string
  let walletPrivateKeys: any = config.walletPrivateKeys
  let walletAddresses: any = config.walletAddresses
  if (isRelayer) {
    if (!(walletPrivateKeys && Array.isArray(walletPrivateKeys))) {
      invalidConfigField('walletPrivateKeys')
    }
  } else {
    if (walletPrivateKeys !== undefined) {
      throw new Error(`Invalid config, only relayer needs private keys`)
    }
    if (!(walletAddresses && Array.isArray(walletAddresses))) {
      throw invalidConfigField('walletAddresses')
    }
  }
  return {
    chainId,
    nativeCurrencySymbol,
    nodeUrl,
    walletPrivateKeys,
    walletAddresses,
  }
}

function invalidConfigField(field: string) {
  throw new Error(`Missing or invalid field in chain config: ${field}`)
}

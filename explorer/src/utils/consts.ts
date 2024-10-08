import {
  ChainId,
  getEmitterAddressEth,
  getEmitterAddressSolana,
  getEmitterAddressTerra,
} from "@alephium/wormhole-sdk";
import { default as alephiumDevnetConfig } from '../../../configs/alephium/devnet.json'
import { default as alephiumTestnetConfig } from '../../../configs/alephium/testnet.json'
import { default as alephiumMainnetConfig } from '../../../configs/alephium/mainnet.json'
import { default as ethereumDevnetConfig } from '../../../configs/ethereum/devnet.json'
import { default as ethereumTestnetConfig } from '../../../configs/ethereum/testnet.json'
import { default as ethereumMainnetConfig } from '../../../configs/ethereum/mainnet.json'
import { default as bscDevnetConfig } from '../../../configs/bsc/devnet.json'
import { default as bscTestnetConfig } from '../../../configs/bsc/testnet.json'
import { default as bscMainnetConfig } from '../../../configs/bsc/mainnet.json'

export const chainEnums = [
  "Ethereum",
  "BSC",
  "Alephium"
];

export interface ChainIDs {
  [index: string]: ChainId;
}

export const chainIDs: ChainIDs = {
  ethereum: 2,
  bsc: 4,
  alephium: 255,
};

export const chainIDStrings: { [chainIDString: string]: string } = {
  "2": "ethereum",
  "4": "bsc",
  "255": "alephium",
};

export enum ChainID {
  Ethereum = 2,
  BSC = 4,
  Alephium = 255,
}
export type ChainName = keyof ChainIDs;
export type ChainIDNumber = ChainIDs[ChainName];

export const METADATA_REPLACE = new RegExp("\u0000", "g");

// Gatsby only includes environment variables that are explicitly referenced, it does the substitution at build time.
// Created this map as a work around to access them dynamically (ie. process.env[someKeyName]).
const envVarMap: { [name: string]: string | undefined } = {
  // devnet
  GATSBY_DEVNET_ETHEREUM_CORE_BRIDGE:
    ethereumDevnetConfig.contracts.governance,
  GATSBY_DEVNET_ETHEREUM_TOKEN_BRIDGE:
    ethereumDevnetConfig.contracts.tokenBridge,
  GATSBY_DEVNET_ETHEREUM_NFT_BRIDGE: undefined,

  GATSBY_DEVNET_ALEPHIUM_CORE_BRIDGE:
    alephiumDevnetConfig.contracts.governance,
  GATSBY_DEVNET_ALEPHIUM_TOKEN_BRIDGE:
    alephiumDevnetConfig.contracts.tokenBridge,
  GATSBY_DEVNET_ALEPHIUM_NFT_BRIDGE: undefined,

  GATSBY_DEVNET_BSC_CORE_BRIDGE:
    bscDevnetConfig.contracts.governance,
  GATSBY_DEVNET_BSC_TOKEN_BRIDGE:
    bscDevnetConfig.contracts.tokenBridge,
  GATSBY_DEVNET_BSC_NFT_BRIDGE: undefined,

  // testnet
  GATSBY_TESTNET_ETHEREUM_CORE_BRIDGE:
    ethereumTestnetConfig.contracts.governance,
  GATSBY_TESTNET_ETHEREUM_TOKEN_BRIDGE:
    ethereumTestnetConfig.contracts.tokenBridge,
  GATSBY_TESTNET_ETHEREUM_NFT_BRIDGE: undefined,

  GATSBY_TESTNET_ALEPHIUM_CORE_BRIDGE:
    alephiumTestnetConfig.contracts.governance,
  GATSBY_TESTNET_ALEPHIUM_TOKEN_BRIDGE:
    alephiumTestnetConfig.contracts.tokenBridge,
  GATSBY_TESTNET_ALEPHIUM_NFT_BRIDGE: undefined,

  GATSBY_TESTNET_BSC_CORE_BRIDGE:
    bscTestnetConfig.contracts.governance,
  GATSBY_TESTNET_BSC_TOKEN_BRIDGE:
    bscTestnetConfig.contracts.tokenBridge,
  GATSBY_TESTNET_BSC_NFT_BRIDGE: undefined,

  // mainnet
  GATSBY_MAINNET_ETHEREUM_CORE_BRIDGE:
    ethereumMainnetConfig.contracts.governance,
  GATSBY_MAINNET_ETHEREUM_TOKEN_BRIDGE:
    ethereumMainnetConfig.contracts.tokenBridge,
  GATSBY_MAINNET_ETHEREUM_NFT_BRIDGE: undefined,

  GATSBY_MAINNET_ALEPHIUM_CORE_BRIDGE:
    alephiumMainnetConfig.contracts.governance,
  GATSBY_MAINNET_ALEPHIUM_TOKEN_BRIDGE:
    alephiumMainnetConfig.contracts.tokenBridge,
  GATSBY_MAINNET_ALEPHIUM_NFT_BRIDGE: undefined,

  GATSBY_MAINNET_BSC_CORE_BRIDGE:
    bscMainnetConfig.contracts.governance,
  GATSBY_MAINNET_BSC_TOKEN_BRIDGE:
    bscMainnetConfig.contracts.tokenBridge,
  GATSBY_MAINNET_BSC_NFT_BRIDGE: undefined,
};

export interface KnownContracts {
  "Token Bridge": string;
  "Core Bridge": string;
  "NFT Bridge": string;
  [address: string]: string;
}
export interface ChainContracts {
  [chainName: string]: KnownContracts;
}
export interface NetworkChains {
  devnet: ChainContracts;
  testnet: ChainContracts;
  mainnet: ChainContracts;
}

const getEmitterAddressEVM = (address: string) =>
  Promise.resolve(getEmitterAddressEth(address));
const getEmitterAddressAlephium = (address: string) =>
  Promise.resolve(address);
const getEmitterAddress: {
  [chainName: string]: (address: string) => Promise<string>;
} = {
  solana: getEmitterAddressSolana,
  ethereum: getEmitterAddressEVM,
  terra: getEmitterAddressTerra,
  bsc: getEmitterAddressEVM,
  polygon: getEmitterAddressEVM,
  avalanche: getEmitterAddressEVM,
  oasis: getEmitterAddressEVM,
  fantom: getEmitterAddressEVM,
  aurora: getEmitterAddressEVM,
  alephium: getEmitterAddressAlephium,
};

// the keys used for creating the map of contract addresses of each chain, on each network.
export type Network = keyof NetworkChains;
export const networks: Array<Network> = ["devnet", "testnet", "mainnet"];
const contractTypes = ["Core", "Token"];
const chainNames = Object.keys(chainIDs);

export const knownContractsPromise = networks.reduce<Promise<NetworkChains>>(
  async (promisedAccum, network) => {
    // Create a data structure to access contract addresses by network, then chain,
    // so that for the network picker.
    // Index by address and name, so you can easily get at the data either way.
    // {
    //     devnet: {
    //         solana: {
    //             'Token Bridge': String(process.env.DEVNET_SOLANA_TOKEN_BRIDGE),
    //             String(process.env.DEVNET_SOLANA_TOKEN_BRIDGE): 'Token Bridge'
    //         },
    //         ethereum: {
    //             'Token Bridge': String(process.env.DEVNET_ETHEREUM_TOKEN_BRIDGE),
    //              String(process.env.DEVNET_ETHEREUM_TOKEN_BRIDGE): 'Token Bridge'
    //         },
    //         terra: {
    //             'Token Bridge': String(process.env.DEVNET_TERRA_TOKEN_BRIDGE),
    //              String(process.env.DEVNET_TERRA_TOKEN_BRIDGE): 'Token Bridge'
    //         },
    //         bsc: {
    //             'Token Bridge': String(process.env.DEVNET_BSC_TOKEN_BRIDGE),
    //              String(process.env.DEVNET_BSC_TOKEN_BRIDGE): 'Token Bridge'
    //         },
    //     },
    //     testnet: {...},
    //     mainnet: {...}
    // }
    const accum = await promisedAccum;
    accum[network] = await chainNames.reduce<Promise<ChainContracts>>(
      async (promisedSubAccum, chainName) => {
        const subAccum = await promisedSubAccum;
        subAccum[chainName] = await contractTypes.reduce<
          Promise<KnownContracts>
        >(async (promisedContractsOfChain, contractType) => {
          const contractsOfChain = await promisedContractsOfChain;
          const envVarName = [
            "GATSBY",
            network.toUpperCase(),
            chainName.toUpperCase(),
            contractType.toUpperCase(),
            "BRIDGE",
          ].join("_");
          let address = envVarMap[envVarName];
          if (address === undefined) throw `missing environment variable: ${envVarName}`;
          const desc = `${contractType} Bridge`;
          // index by: description, contract address, and emitter address
          try {
            const emitterAddress = await getEmitterAddress[chainName](address);
            contractsOfChain[emitterAddress] = desc;
          } catch (_) {
            console.log(`failed getting emitterAddress for: ${address}, env: ${envVarName}, chainName: ${chainName}`);
          }
          if (chainName != "solana") {
            address = address.toLowerCase();
          }
          contractsOfChain[desc] = address;
          contractsOfChain[address] = desc;
          return contractsOfChain;
        }, Promise.resolve(Object()));
        return subAccum;
      },
      Promise.resolve(Object())
    );
    return accum;
  },
  Promise.resolve(Object())
);

export interface NetworkConfig {
  backendUrl: string;
}
export const endpoints: { [network: string]: NetworkConfig } = {
  devnet: {
    backendUrl: String(
      process.env.GATSBY_DEVNET_BACKEND_URL
    ),
  },
  testnet: {
    backendUrl: String(
      process.env.GATSBY_TESTNET_BACKEND_URL
    ),
  },
  mainnet: {
    backendUrl: String(
      process.env.GATSBY_MAINNET_BACKEND_URL
    ),
  },
};

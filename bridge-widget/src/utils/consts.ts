import {
  alephium_contracts,
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ACALA,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_AURORA,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_CELO,
  CHAIN_ID_ETH,
  CHAIN_ID_ETHEREUM_ROPSTEN,
  CHAIN_ID_FANTOM,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_NEON,
  CHAIN_ID_OASIS,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  isEVMChain,
  MAINNET_ALPH_MINIMAL_CONSISTENCY_LEVEL,
  TESTNET_ALPH_MINIMAL_CONSISTENCY_LEVEL,
  DEVNET_ALPH_MINIMAL_CONSISTENCY_LEVEL,
} from '@alephium/wormhole-sdk';
import { clusterApiUrl } from '@solana/web3.js';
import { getAddress } from 'ethers/lib/utils';
import { CHAIN_CONFIG_MAP } from '../config';
import bscIcon from '../../../bridge-assets/icons/bsc.svg';
import ethIcon from '../../../bridge-assets/icons/eth.svg';
import alephiumIcon from '../../../bridge-assets/icons/alephium.svg';
import {
  testnetTokensMetadata,
  mainnetTokensMetadata,
  TokenInfo,
} from '@alephium/token-list';
import { default as alephiumDevnetConfig } from '../../../configs/alephium/devnet.json';
import { default as alephiumTestnetConfig } from '../../../configs/alephium/testnet.json';
import { default as alephiumMainnetConfig } from '../../../configs/alephium/mainnet.json';
import { default as ethereumDevnetConfig } from '../../../configs/ethereum/devnet.json';
import { default as ethereumTestnetConfig } from '../../../configs/ethereum/testnet.json';
import { default as ethereumMainnetConfig } from '../../../configs/ethereum/mainnet.json';
import { default as bscDevnetConfig } from '../../../configs/bsc/devnet.json';
import { default as bscTestnetConfig } from '../../../configs/bsc/testnet.json';
import { default as bscMainnetConfig } from '../../../configs/bsc/mainnet.json';
import { default as guardianDevnetConfig } from '../../../configs/guardian/devnet.json';
import { default as guardianTestnetConfig } from '../../../configs/guardian/testnet.json';
import { default as guardianMainnetConfig } from '../../../configs/guardian/mainnet.json';

export const alphArbiterFee = BigInt('0');

export interface ChainInfo {
  id: ChainId;
  name: string;
  logo: string;
}
const alephiumChainInfo: ChainInfo = {
  id: CHAIN_ID_ALEPHIUM,
  name: 'Alephium',
  logo: alephiumIcon,
};

export type Cluster = 'mainnet' | 'testnet' | 'devnet';

let currentCluster: Cluster =
  import.meta.env.VITE_REACT_APP_CLUSTER === 'mainnet'
    ? 'mainnet'
    : import.meta.env.VITE_REACT_APP_CLUSTER === 'testnet'
    ? 'testnet'
    : 'devnet';

export function setCluster(cluster: Cluster) {
  currentCluster = cluster;
}

export const getCluster = (): Cluster => currentCluster;

export type ChainsById = { [key in ChainId]: ChainInfo };

const MAINNET_CHAINS: ChainInfo[] = [
  {
    id: CHAIN_ID_BSC,
    name: 'Binance Smart Chain',
    logo: bscIcon,
  },
  {
    id: CHAIN_ID_ETH,
    name: 'Ethereum',
    logo: ethIcon,
  },
  alephiumChainInfo,
];

const TESTNET_CHAINS: ChainInfo[] = [
  {
    id: CHAIN_ID_BSC,
    name: 'Binance Smart Chain',
    logo: bscIcon,
  },
  {
    id: CHAIN_ID_ETH,
    name: 'Ethereum (Sepolia)',
    logo: ethIcon,
  },
  alephiumChainInfo,
];

const MAINNET_BETA_CHAINS: ChainId[] = [CHAIN_ID_ACALA, CHAIN_ID_KLAYTN];

const EMPTY_ARRAY = [];

const MAINNET_CHAINS_WITH_NFT_SUPPORT: ChainInfo[] = MAINNET_CHAINS.filter(
  ({ id }) => id === CHAIN_ID_ETH,
);
const TESTNET_CHAINS_WITH_NFT_SUPPORT: ChainInfo[] = TESTNET_CHAINS.filter(
  ({ id }) => id === CHAIN_ID_ETH,
);
const MAINNET_CHAINS_BY_ID = MAINNET_CHAINS.reduce((obj, chain) => {
  obj[chain.id] = chain;
  return obj;
}, {} as ChainsById);
const TESTNET_CHAINS_BY_ID = TESTNET_CHAINS.reduce((obj, chain) => {
  obj[chain.id] = chain;
  return obj;
}, {} as ChainsById);

const ALGORAND_MAINNET_HOST = {
  algodToken: '',
  algodServer: 'https://mainnet-api.algonode.cloud',
  algodPort: '',
};
const ALGORAND_TESTNET_HOST = {
  algodToken: '',
  algodServer: 'https://testnet-api.algonode.cloud',
  algodPort: '',
};
const ALGORAND_DEVNET_HOST = {
  algodToken:
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  algodServer: 'http://localhost',
  algodPort: '4001',
};

const MAINNET_BSC_MARKET_WARNINGS = [
  getAddress(bscMainnetConfig.contracts.wrappedNative),
  getAddress('0xe9e7cea3dedca5984780bafc599bd69add087d56'), // BUSD
  getAddress('0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'), // USDC
  getAddress('0x55d398326f99059ff775485246999027b3197955'), // BSC-USD
];

const TESTNET_BSC_MARKET_WARNINGS = [...MAINNET_BSC_MARKET_WARNINGS];
TESTNET_BSC_MARKET_WARNINGS[0] = getAddress(
  bscTestnetConfig.contracts.wrappedNative,
);

const DEVNET_BSC_MARKET_WARNINGS = [...MAINNET_BSC_MARKET_WARNINGS];
DEVNET_BSC_MARKET_WARNINGS[0] = getAddress(
  bscDevnetConfig.contracts.wrappedNative,
);

const MAINNET_ETH_MIGRATION_ASSET_MAP = new Map<string, string>([
  [
    // LUNA
    getAddress('0xd2877702675e6cEb975b4A1dFf9fb7BAF4C91ea9'),
    getAddress('0xe76820F1DB773B1d62a3D22F47259705cC5fA4E6'),
  ],
  [
    // UST
    getAddress('0xa47c8bf37f92aBed4A126BDA807A7b7498661acD'),
    getAddress('0xF39C29d8f6851d87c40c83b61078EB7384f7Cb51'),
  ],
]);

const TESTNET_ETH_MIGRATION_ASSET_MAP = new Map<string, string>([]);

const MAINNET_MIGRATION_ASSET_MAP = new Map<string, string>([
  [
    // HUSD
    'BybpSTBoZHsmKnfxYG47GDhVPKrnEKX31CScShbrzUhX',
    '7VQo3HFLNH5QqGtM8eC3XQbPkJUu7nS9LeGWjerRh5Sw',
  ],
  [
    // BUSD
    'AJ1W9A9N9dEMdVyoDiam2rV44gnBm2csrPDP7xqcapgX',
    '33fsBLA8djQm82RpHmE3SuVrPGtZBWNYExsEUeKX1HXX',
  ],
  [
    // HBTC
    '8pBc4v9GAwCBNWPB5XKA93APexMGAS4qMr37vNke9Ref',
    '7dVH61ChzgmN9BwG4PkzwRP8PbYwPJ7ZPNF2vamKT2H8',
  ],
  [
    // DAI
    'FYpdBuyAHSbdaAyD1sKkxyLWbAP8uUW9h6uvdhK74ij1',
    'EjmyN6qEC1Tf1JxiG1ae7UTJhUxSwk1TCWNWqxWV4J6o',
  ],
  [
    // FRAX
    '8L8pDf3jutdpdr4m3np68CL9ZroLActrqwxi6s9Ah5xU',
    'FR87nWEUxVgerFGhZM8Y4AggKGLnaXswr1Pd8wZ4kZcp',
  ],
  [
    // USDK
    '2kycGCD8tJbrjJJqWN2Qz5ysN9iB4Bth3Uic4mSB7uak',
    '43m2ewFV5nDepieFjT9EmAQnc1HRtAF247RBpLGFem5F',
  ],
  // [
  //   // UST
  //   "CXLBjMMcwkc17GfJtBos6rQCo1ypeH6eDbB82Kby4MRm",
  //   "5Un6AdG9GBjxVhTSvvt2x6X6vtN1zrDxkkDpDcShnHfF",
  // ],
  [
    // UST
    'CXLBjMMcwkc17GfJtBos6rQCo1ypeH6eDbB82Kby4MRm',
    '9vMJfxuKxXBoEa7rM12mYLMwTacLMLDJqHozw96WQL8i',
  ],
  // [
  //   // Wrapped LUNA
  //   "2Xf2yAXJfg82sWwdLUo2x9mZXy6JCdszdMZkcF1Hf4KV",
  //   "EQTV1LW23Mgtjb5LXSg9NGw1J32oqTV4HCPmHCVSGmqD",
  // ],
  [
    // Wrapped LUNA
    '2Xf2yAXJfg82sWwdLUo2x9mZXy6JCdszdMZkcF1Hf4KV',
    'F6v4wfAdJB8D8p77bMXZgYt8TDKsYxLYxH5AFhUkYx9W',
  ],
  [
    // FTT
    'GbBWwtYTMPis4VHb8MrBbdibPhn28TSrLB53KvUmb7Gi',
    'EzfgjvkSwthhgHaceR3LnKXUoRkP6NUhfghdaHAj1tUv',
  ],
  [
    // SRM
    '2jXy799YnEcRXneFo2GEAB6SDRsAa767HpWmktRr1DaP',
    'xnorPhAzWXUczCP3KjU5yDxmKKZi5cSbxytQ1LgE3kG',
  ],
  [
    // FTT (Sollet)
    'AGFEad2et2ZJif9jaGpdMixQqvW5i81aBdvKe7PHNfz3',
    'EzfgjvkSwthhgHaceR3LnKXUoRkP6NUhfghdaHAj1tUv',
  ],
  [
    // WETH (Sollet)
    '2FPyTwcZLUg1MDrwsyoP4D6s1tM7hAkHYRjkNb5w6Pxk',
    '7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs',
  ],
  [
    // UNI (Sollet)
    'DEhAasscXF4kEGxFgJ3bq4PpVGp5wyUxMRvn6TzGVHaw',
    '8FU95xFJhUUkyyCLU13HSzDLs7oC4QZdXQHL6SCeab36',
  ],
  [
    // HXRO (Sollet)
    'DJafV9qemGp7mLMEn5wrfqaFwxsbLgUsGVS16zKRk9kc',
    'HxhWkVpk5NS4Ltg5nij2G671CKXFRKPK8vy271Ub4uEK',
  ],
  [
    // ALEPH (Sollet)
    'CsZ5LZkDS7h9TDKjrbL7VAwQZ9nsRu8vJLhRYfmGaN8K',
    '3UCMiSnkcnkPE1pgQ5ggPCBv6dXgVUy16TmMUe1WpG9x',
  ],
  [
    // TOMOE (Sollet)
    'GXMvfY2jpQctDqZ9RoU3oWPhufKiCcFEfchvYumtX7jd',
    '46AiRdka3HYGkhV6r9gyS6Teo9cojfGXfK8oniALYMZx',
  ],
]);

const TESTNET_MIGRATION_ASSET_MAP = new Map<string, string>([
  [
    'orcarKHSqC5CDDsGbho8GKvwExejWHxTqGzXgcewB9L', //This is not actually a v1 asset
    'orcarKHSqC5CDDsGbho8GKvwExejWHxTqGzXgcewB9L',
  ],
]);

const DEVNET_MIGRATION_ASSET_MAP = new Map<string, string>([]);

const MAINNET_MULTI_CHAIN_TOKENS = {
  [CHAIN_ID_SOLANA]: {
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
    Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
  },
  [CHAIN_ID_ETH]: {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'USDC',
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 'USDT',
  },
  [CHAIN_ID_TERRA]: {},
  [CHAIN_ID_BSC]: {
    '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'USDC',
    '0x55d398326f99059ff775485246999027b3197955': 'USDT',
  },
  [CHAIN_ID_POLYGON]: {
    '0x2791bca1f2de4661ed88a30c99a7a9449aa84174': 'USDC',
    '0xc2132d05d31c914a87c6611c10748aeb04b58e8f': 'USDT',
  },
} as MultiChainInfo;

const TESTNET_MULTI_CHAIN_TOKENS = {
  [CHAIN_ID_SOLANA]: {
    '2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ': 'SOLT',
  },
  [CHAIN_ID_ETH]: {},
  [CHAIN_ID_TERRA]: {},
  [CHAIN_ID_BSC]: {},
  [CHAIN_ID_POLYGON]: {},
} as MultiChainInfo;

export const getConst = (
  constant:
    | 'CHAINS'
    | 'BETA_CHAINS'
    | 'CHAINS_WITH_NFT_SUPPORT'
    | 'CHAINS_BY_ID'
    | 'WORMHOLE_RPC_HOSTS'
    | 'ETH_NETWORK_CHAIN_ID'
    | 'ROPSTEN_ETH_NETWORK_CHAIN_ID'
    | 'BSC_NETWORK_CHAIN_ID'
    | 'POLYGON_NETWORK_CHAIN_ID'
    | 'AVAX_NETWORK_CHAIN_ID'
    | 'OASIS_NETWORK_CHAIN_ID'
    | 'AURORA_NETWORK_CHAIN_ID'
    | 'FANTOM_NETWORK_CHAIN_ID'
    | 'KARURA_NETWORK_CHAIN_ID'
    | 'ACALA_NETWORK_CHAIN_ID'
    | 'KLAYTN_NETWORK_CHAIN_ID'
    | 'CELO_NETWORK_CHAIN_ID'
    | 'NEON_NETWORK_CHAIN_ID'
    | 'SOLANA_HOST'
    | 'ETH_RPC_HOST'
    | 'BSC_RPC_HOST'
    | 'EXPLORER_API_SERVER_HOST'
    | 'RELAYER_HOST'
    | 'ALEPHIUM_HOST'
    | 'ALEPHIUM_EXPLORER_HOST'
    | 'ALGORAND_HOST'
    | 'KARURA_HOST'
    | 'ACALA_HOST'
    | 'ETH_BRIDGE_ADDRESS'
    | 'ETH_NFT_BRIDGE_ADDRESS'
    | 'ETH_TOKEN_BRIDGE_ADDRESS'
    | 'BSC_BRIDGE_ADDRESS'
    | 'BSC_NFT_BRIDGE_ADDRESS'
    | 'BSC_TOKEN_BRIDGE_ADDRESS'
    | 'BSC_TOKENS_FOR_REWARD'
    | 'POLYGON_BRIDGE_ADDRESS'
    | 'POLYGON_NFT_BRIDGE_ADDRESS'
    | 'POLYGON_TOKEN_BRIDGE_ADDRESS'
    | 'AVAX_BRIDGE_ADDRESS'
    | 'AVAX_NFT_BRIDGE_ADDRESS'
    | 'AVAX_TOKEN_BRIDGE_ADDRESS'
    | 'OASIS_BRIDGE_ADDRESS'
    | 'OASIS_NFT_BRIDGE_ADDRESS'
    | 'OASIS_TOKEN_BRIDGE_ADDRESS'
    | 'AURORA_BRIDGE_ADDRESS'
    | 'AURORA_NFT_BRIDGE_ADDRESS'
    | 'AURORA_TOKEN_BRIDGE_ADDRESS'
    | 'FANTOM_BRIDGE_ADDRESS'
    | 'ALEPHIUM_BRIDGE_ADDRESS'
    | 'FANTOM_NFT_BRIDGE_ADDRESS'
    | 'FANTOM_TOKEN_BRIDGE_ADDRESS'
    | 'KARURA_BRIDGE_ADDRESS'
    | 'KARURA_NFT_BRIDGE_ADDRESS'
    | 'KARURA_TOKEN_BRIDGE_ADDRESS'
    | 'KLAYTN_BRIDGE_ADDRESS'
    | 'KLAYTN_NFT_BRIDGE_ADDRESS'
    | 'KLAYTN_TOKEN_BRIDGE_ADDRESS'
    | 'CELO_BRIDGE_ADDRESS'
    | 'CELO_NFT_BRIDGE_ADDRESS'
    | 'CELO_TOKEN_BRIDGE_ADDRESS'
    | 'NEON_BRIDGE_ADDRESS'
    | 'NEON_NFT_BRIDGE_ADDRESS'
    | 'NEON_TOKEN_BRIDGE_ADDRESS'
    | 'SOL_BRIDGE_ADDRESS'
    | 'SOL_NFT_BRIDGE_ADDRESS'
    | 'SOL_TOKEN_BRIDGE_ADDRESS'
    | 'ROPSTEN_ETH_BRIDGE_ADDRESS'
    | 'ROPSTEN_ETH_NFT_BRIDGE_ADDRESS'
    | 'ROPSTEN_ETH_TOKEN_BRIDGE_ADDRESS'
    | 'ALGORAND_BRIDGE_ID'
    | 'ALGORAND_TOKEN_BRIDGE_ID'
    | 'ALGORAND_WAIT_FOR_CONFIRMATIONS'
    | 'ALEPHIUM_MESSAGE_FEE'
    | 'ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID'
    | 'ALEPHIUM_BRIDGE_REWARD_ROUTER_ID'
    | 'ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL'
    | 'ALEPHIUM_NETWORK_ID'
    | 'ALEPHIUM_BRIDGE_GROUP_INDEX'
    | 'ALEPHIUM_TOKEN_LIST'
    | 'ALEPHIUM_POLLING_INTERVAL'
    | 'COVALENT_BSC'
    | 'COVALENT_POLYGON'
    | 'COVALENT_AVAX'
    | 'COVALENT_FANTOM'
    | 'COVALENT_KLAYTN'
    | 'COVALENT_CELO'
    | 'COVALENT_NEON'
    | 'WETH_ADDRESS'
    | 'WBNB_ADDRESS'
    | 'WMATIC_ADDRESS'
    | 'ROPSTEN_WETH_ADDRESS'
    | 'WAVAX_ADDRESS'
    | 'WROSE_ADDRESS'
    | 'WETH_AURORA_ADDRESS'
    | 'WFTM_ADDRESS'
    | 'KAR_ADDRESS'
    | 'ACA_ADDRESS'
    | 'WKLAY_ADDRESS'
    | 'CELO_ADDRESS'
    | 'WNEON_ADDRESS'
    | 'WORMHOLE_V1_ETH_ADDRESS'
    | 'WORMHOLE_V1_SOLANA_ADDRESS'
    | 'WORMHOLE_V1_MINT_AUTHORITY'
    | 'BSC_MARKET_WARNINGS'
    | 'MIGRATION_PROGRAM_ADDRESS'
    | 'MIGRATION_ASSET_MAP'
    | 'ETH_MIGRATION_ASSET_MAP'
    | 'MULTI_CHAIN_TOKENS'
    | 'RELAYER_INFO_URL'
    | 'ACALA_RELAYER_URL'
    | 'ACALA_RELAY_URL'
    | 'ACALA_SHOULD_RELAY_URL',
) => {
  const CLUSTER = getCluster();

  switch (constant) {
    case 'CHAINS':
      return CLUSTER === 'mainnet'
        ? MAINNET_CHAINS
        : CLUSTER === 'testnet'
        ? TESTNET_CHAINS
        : MAINNET_CHAINS;

    case 'BETA_CHAINS':
      return CLUSTER === 'mainnet' ? MAINNET_BETA_CHAINS : EMPTY_ARRAY;

    case 'CHAINS_WITH_NFT_SUPPORT':
      return CLUSTER === 'mainnet'
        ? MAINNET_CHAINS_WITH_NFT_SUPPORT
        : CLUSTER === 'testnet'
        ? TESTNET_CHAINS_WITH_NFT_SUPPORT
        : MAINNET_CHAINS_WITH_NFT_SUPPORT;

    case 'CHAINS_BY_ID':
      return CLUSTER === 'mainnet'
        ? MAINNET_CHAINS_BY_ID
        : CLUSTER === 'testnet'
        ? TESTNET_CHAINS_BY_ID
        : MAINNET_CHAINS_BY_ID;

    case 'WORMHOLE_RPC_HOSTS':
      return CLUSTER === 'mainnet'
        ? guardianMainnetConfig.guardianUrls
        : CLUSTER === 'testnet'
        ? guardianTestnetConfig.guardianUrls
        : guardianDevnetConfig.guardianUrls;

    case 'ETH_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet'
        ? 1
        : CLUSTER === 'testnet'
        ? 11155111
        : 1338;

    case 'ROPSTEN_ETH_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet' ? 1 : CLUSTER === 'testnet' ? 3 : 1337;

    case 'BSC_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet' ? 56 : CLUSTER === 'testnet' ? 97 : 1397;

    case 'POLYGON_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet' ? 137 : CLUSTER === 'testnet' ? 80001 : 1381;

    case 'AVAX_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet'
        ? 43114
        : CLUSTER === 'testnet'
        ? 43113
        : 1381;

    case 'OASIS_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet'
        ? 42262
        : CLUSTER === 'testnet'
        ? 42261
        : 1381;

    case 'AURORA_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet'
        ? 1313161554
        : CLUSTER === 'testnet'
        ? 1313161555
        : 1381;

    case 'FANTOM_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet' ? 250 : CLUSTER === 'testnet' ? 4002 : 1381;

    case 'KARURA_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet' ? 686 : CLUSTER === 'testnet' ? 596 : 1381;

    case 'ACALA_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet' ? 787 : CLUSTER === 'testnet' ? 597 : 1381;

    case 'KLAYTN_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet' ? 8217 : CLUSTER === 'testnet' ? 1001 : 1381;

    case 'CELO_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet'
        ? 42220
        : CLUSTER === 'testnet'
        ? 44787
        : 1381;

    case 'NEON_NETWORK_CHAIN_ID':
      return CLUSTER === 'mainnet'
        ? 245022934
        : CLUSTER === 'testnet'
        ? 245022926
        : 1381;

    case 'SOLANA_HOST':
      return process.env.REACT_APP_SOLANA_API_URL
        ? process.env.REACT_APP_SOLANA_API_URL
        : CLUSTER === 'mainnet'
        ? clusterApiUrl('mainnet-beta')
        : CLUSTER === 'testnet'
        ? clusterApiUrl('devnet')
        : 'http://localhost:8899';

    case 'ETH_RPC_HOST':
      return CLUSTER === 'mainnet'
        ? 'https://eth-mainnet.public.blastapi.io'
        : CLUSTER === 'testnet'
        ? 'https://eth-sepolia.public.blastapi.io'
        : 'http://localhost:8545';

    case 'BSC_RPC_HOST':
      return CLUSTER === 'mainnet'
        ? 'https://bsc-mainnet.public.blastapi.io'
        : CLUSTER === 'testnet'
        ? 'https://bsc-testnet.public.blastapi.io'
        : 'http://localhost:8546';

    case 'EXPLORER_API_SERVER_HOST':
      return CLUSTER === 'mainnet'
        ? 'https://indexer-api.explorer.bridge.alephium.org'
        : CLUSTER === 'testnet'
        ? 'https://indexer-api.explorer.testnet.bridge.alephium.org'
        : 'http://localhost:8100';

    case 'RELAYER_HOST':
      return CLUSTER === 'mainnet'
        ? 'https://relayer.bridge.alephium.org'
        : CLUSTER === 'testnet'
        ? 'https://relayer.testnet.bridge.alephium.org'
        : 'http://localhost:31000';

    case 'ALEPHIUM_HOST':
      return CLUSTER === 'mainnet'
        ? alephiumMainnetConfig.nodeUrl
        : CLUSTER === 'testnet'
        ? alephiumTestnetConfig.nodeUrl
        : alephiumDevnetConfig.nodeUrl;

    case 'ALEPHIUM_EXPLORER_HOST':
      return CLUSTER === 'mainnet'
        ? alephiumMainnetConfig.explorerUrl
        : CLUSTER === 'testnet'
        ? alephiumTestnetConfig.explorerUrl
        : alephiumDevnetConfig.explorerUrl;

    case 'ALGORAND_HOST':
      return CLUSTER === 'mainnet'
        ? ALGORAND_MAINNET_HOST
        : CLUSTER === 'testnet'
        ? ALGORAND_TESTNET_HOST
        : ALGORAND_DEVNET_HOST;

    case 'KARURA_HOST':
      return CLUSTER === 'mainnet'
        ? 'https://eth-rpc-karura.aca-api.network/'
        : CLUSTER === 'testnet'
        ? 'https://karura-dev.aca-dev.network/eth/http'
        : '';

    case 'ACALA_HOST':
      return CLUSTER === 'mainnet'
        ? 'https://eth-rpc-acala.aca-api.network/'
        : CLUSTER === 'testnet'
        ? 'https://acala-dev.aca-dev.network/eth/http'
        : '';

    case 'ETH_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? ethereumMainnetConfig.contracts.governance
          : CLUSTER === 'testnet'
          ? ethereumTestnetConfig.contracts.governance
          : ethereumDevnetConfig.contracts.governance,
      );

    case 'ETH_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x6FFd7EdE62328b3Af38FCD61461Bbfc52F5651fE'
          : CLUSTER === 'testnet'
          ? '0x14cAD5A8A887020e1198B26fFA2814bC6415D18F'
          : '0x26b4afb60d6c903165150c6f0aa14f8016be4aec',
      );

    case 'ETH_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? ethereumMainnetConfig.contracts.tokenBridge
          : CLUSTER === 'testnet'
          ? ethereumTestnetConfig.contracts.tokenBridge
          : ethereumDevnetConfig.contracts.tokenBridge,
      );

    case 'BSC_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? bscMainnetConfig.contracts.governance
          : CLUSTER === 'testnet'
          ? bscTestnetConfig.contracts.governance
          : bscDevnetConfig.contracts.governance,
      );

    case 'BSC_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE'
          : CLUSTER === 'testnet'
          ? '0xcD16E5613EF35599dc82B24Cb45B5A93D779f1EE'
          : '0x26b4afb60d6c903165150c6f0aa14f8016be4aec',
      );
    case 'BSC_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? bscMainnetConfig.contracts.tokenBridge
          : CLUSTER === 'testnet'
          ? bscTestnetConfig.contracts.tokenBridge
          : bscDevnetConfig.contracts.tokenBridge,
      );
    case 'BSC_TOKENS_FOR_REWARD':
      return CLUSTER === 'mainnet'
        ? bscMainnetConfig.tokensForReward
        : CLUSTER === 'testnet'
        ? bscTestnetConfig.tokensForReward
        : bscDevnetConfig.tokensForReward;
    case 'POLYGON_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7'
          : CLUSTER === 'testnet'
          ? '0x0CBE91CF822c73C2315FB05100C2F714765d5c20'
          : '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
      );
    case 'POLYGON_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x90BBd86a6Fe93D3bc3ed6335935447E75fAb7fCf'
          : CLUSTER === 'testnet'
          ? '0x51a02d0dcb5e52F5b92bdAA38FA013C91c7309A9'
          : '0x26b4afb60d6c903165150c6f0aa14f8016be4aec',
      );
    case 'POLYGON_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE'
          : CLUSTER === 'testnet'
          ? '0x377D55a7928c046E18eEbb61977e714d2a76472a'
          : '0x0290FB167208Af455bB137780163b7B7a9a10C16',
      );
    case 'AVAX_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x54a8e5f9c4CbA08F9943965859F6c34eAF03E26c'
          : CLUSTER === 'testnet'
          ? '0x7bbcE28e64B3F8b84d876Ab298393c38ad7aac4C'
          : '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
      );
    case 'AVAX_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0xf7B6737Ca9c4e08aE573F75A97B73D7a813f5De5'
          : CLUSTER === 'testnet'
          ? '0xD601BAf2EEE3C028344471684F6b27E789D9075D'
          : '0x26b4afb60d6c903165150c6f0aa14f8016be4aec',
      );
    case 'AVAX_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x0e082F06FF657D94310cB8cE8B0D9a04541d8052'
          : CLUSTER === 'testnet'
          ? '0x61E44E506Ca5659E6c0bba9b678586fA2d729756'
          : '0x0290FB167208Af455bB137780163b7B7a9a10C16',
      );
    case 'OASIS_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0xfE8cD454b4A1CA468B57D79c0cc77Ef5B6f64585'
          : CLUSTER === 'testnet'
          ? '0xc1C338397ffA53a2Eb12A7038b4eeb34791F8aCb'
          : '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
      );
    case 'OASIS_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x04952D522Ff217f40B5Ef3cbF659EcA7b952a6c1'
          : CLUSTER === 'testnet'
          ? '0xC5c25B41AB0b797571620F5204Afa116A44c0ebA'
          : '0x26b4afb60d6c903165150c6f0aa14f8016be4aec',
      );
    case 'OASIS_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x5848C791e09901b40A9Ef749f2a6735b418d7564'
          : CLUSTER === 'testnet'
          ? '0x88d8004A9BdbfD9D28090A02010C19897a29605c'
          : '0x0290FB167208Af455bB137780163b7B7a9a10C16',
      );
    case 'AURORA_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0xa321448d90d4e5b0A732867c18eA198e75CAC48E'
          : CLUSTER === 'testnet'
          ? '0xBd07292de7b505a4E803CEe286184f7Acf908F5e'
          : '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
      );
    case 'AURORA_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x6dcC0484472523ed9Cdc017F711Bcbf909789284'
          : CLUSTER === 'testnet'
          ? '0x8F399607E9BA2405D87F5f3e1B78D950b44b2e24'
          : '0x26b4afb60d6c903165150c6f0aa14f8016be4aec',
      );
    case 'AURORA_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x51b5123a7b0F9b2bA265f9c4C8de7D78D52f510F'
          : CLUSTER === 'testnet'
          ? '0xD05eD3ad637b890D68a854d607eEAF11aF456fba'
          : '0x0290FB167208Af455bB137780163b7B7a9a10C16',
      );
    case 'ALEPHIUM_BRIDGE_ADDRESS':
      return CLUSTER === 'mainnet'
        ? alephiumMainnetConfig.contracts.nativeGovernance
        : CLUSTER === 'testnet'
        ? alephiumTestnetConfig.contracts.nativeGovernance
        : alephiumDevnetConfig.contracts.nativeGovernance;
    case 'FANTOM_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x126783A6Cb203a3E35344528B26ca3a0489a1485'
          : CLUSTER === 'testnet'
          ? '0x1BB3B4119b7BA9dfad76B0545fb3F531383c3bB7'
          : '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
      );
    case 'FANTOM_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0xA9c7119aBDa80d4a4E0C06C8F4d8cF5893234535'
          : CLUSTER === 'testnet'
          ? '0x63eD9318628D26BdCB15df58B53BB27231D1B227'
          : '0x26b4afb60d6c903165150c6f0aa14f8016be4aec',
      );
    case 'FANTOM_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x7C9Fc5741288cDFdD83CeB07f3ea7e22618D79D2'
          : CLUSTER === 'testnet'
          ? '0x599CEa2204B4FaECd584Ab1F2b6aCA137a0afbE8'
          : '0x0290FB167208Af455bB137780163b7B7a9a10C16',
      );
    case 'KARURA_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0xa321448d90d4e5b0A732867c18eA198e75CAC48E'
          : CLUSTER === 'testnet'
          ? '0xE4eacc10990ba3308DdCC72d985f2a27D20c7d03'
          : '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
      );
    case 'KARURA_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0xb91e3638F82A1fACb28690b37e3aAE45d2c33808'
          : CLUSTER === 'testnet'
          ? '0x0A693c2D594292B6Eb89Cb50EFe4B0b63Dd2760D'
          : '0x26b4afb60d6c903165150c6f0aa14f8016be4aec',
      );
    case 'KARURA_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0xae9d7fe007b3327AA64A32824Aaac52C42a6E624'
          : CLUSTER === 'testnet'
          ? '0xd11De1f930eA1F7Dd0290Fe3a2e35b9C91AEFb37'
          : '0x0290FB167208Af455bB137780163b7B7a9a10C16',
      );
    case 'KLAYTN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x0C21603c4f3a6387e241c0091A7EA39E43E90bb7'
          : CLUSTER === 'testnet'
          ? '0x1830CC6eE66c84D2F177B94D544967c774E624cA'
          : '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
      );
    case 'KLAYTN_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x3c3c561757BAa0b78c5C025CdEAa4ee24C1dFfEf'
          : CLUSTER === 'testnet'
          ? '0x94c994fC51c13101062958b567e743f1a04432dE'
          : '0x26b4afb60d6c903165150c6f0aa14f8016be4aec',
      );
    case 'KLAYTN_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x5b08ac39EAED75c0439FC750d9FE7E1F9dD0193F'
          : CLUSTER === 'testnet'
          ? '0xC7A13BE098720840dEa132D860fDfa030884b09A'
          : '0x0290FB167208Af455bB137780163b7B7a9a10C16',
      );
    case 'CELO_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0xa321448d90d4e5b0A732867c18eA198e75CAC48E'
          : CLUSTER === 'testnet'
          ? '0x88505117CA88e7dd2eC6EA1E13f0948db2D50D56'
          : '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
      );
    case 'CELO_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0xA6A377d75ca5c9052c9a77ED1e865Cc25Bd97bf3'
          : CLUSTER === 'testnet'
          ? '0xaCD8190F647a31E56A656748bC30F69259f245Db'
          : '0x26b4afb60d6c903165150c6f0aa14f8016be4aec',
      );
    case 'CELO_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x796Dff6D74F3E27060B71255Fe517BFb23C93eed'
          : CLUSTER === 'testnet'
          ? '0x05ca6037eC51F8b712eD2E6Fa72219FEaE74E153'
          : '0x0290FB167208Af455bB137780163b7B7a9a10C16',
      );
    case 'NEON_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x0000000000000000000000000000000000000000'
          : CLUSTER === 'testnet'
          ? '0x0000000000000000000000000000000000000000'
          : '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
      );
    case 'NEON_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x0000000000000000000000000000000000000000'
          : CLUSTER === 'testnet'
          ? '0x0000000000000000000000000000000000000000'
          : '0x26b4afb60d6c903165150c6f0aa14f8016be4aec',
      );
    case 'NEON_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x0000000000000000000000000000000000000000'
          : CLUSTER === 'testnet'
          ? '0x0000000000000000000000000000000000000000'
          : '0x0290FB167208Af455bB137780163b7B7a9a10C16',
      );

    case 'SOL_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? 'worm2ZoG2kUd4vFXhvjh93UUH596ayRfgQ2MgjNMTth'
          : CLUSTER === 'testnet'
          ? '3u8hJUVTA4jH1wYAyUur7FFZVQ8H635K3tSHHF4ssjQ5'
          : 'Bridge1p5gheXUvJ6jGWGeCsgPKgnE3YgdGKRVCMY9o',
      );
    case 'SOL_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? 'WnFt12ZrnzZrFZkt2xsNsaNWoQribnuQ5B5FrDbwDhD'
          : CLUSTER === 'testnet'
          ? '2rHhojZ7hpu1zA91nvZmT8TqWWvMcKmmNBCr2mKTtMq4'
          : 'NFTWqJR8YnRVqPDvTJrYuLrQDitTG5AScqbeghi4zSA',
      );
    case 'SOL_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? 'wormDTUJ6AWPNvk59vGQbDvGJmqbDTdgWgAqcLBCgUb'
          : CLUSTER === 'testnet'
          ? 'DZnkkTmCiFWfYTfT41X3Rd1kDgozqzxWaHqsw6W4x2oe'
          : 'B6RHG3mfcckmrYN1UhmJzyS1XX3fZKbkeUcpJe9Sy3FE',
      );
    case 'ROPSTEN_ETH_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B'
          : CLUSTER === 'testnet'
          ? '0x210c5F5e2AF958B4defFe715Dc621b7a3BA888c5'
          : '0xC89Ce4735882C9F0f0FE26686c53074E09B0D550',
      );
    case 'ROPSTEN_ETH_NFT_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x6FFd7EdE62328b3Af38FCD61461Bbfc52F5651fE'
          : CLUSTER === 'testnet'
          ? '0x2b048Da40f69c8dc386a56705915f8E966fe1eba'
          : '0x26b4afb60d6c903165150c6f0aa14f8016be4aec',
      );
    case 'ROPSTEN_ETH_TOKEN_BRIDGE_ADDRESS':
      return getAddress(
        CLUSTER === 'mainnet'
          ? '0x3ee18B2214AFF97000D974cf647E7C347E8fa585'
          : CLUSTER === 'testnet'
          ? '0xF174F9A837536C449321df1Ca093Bb96948D5386'
          : '0x0290FB167208Af455bB137780163b7B7a9a10C16',
      );

    case 'ALGORAND_BRIDGE_ID':
      return BigInt(
        CLUSTER === 'mainnet' ? '0' : CLUSTER === 'testnet' ? '86525623' : '4',
      );
    case 'ALGORAND_TOKEN_BRIDGE_ID':
      return BigInt(
        CLUSTER === 'mainnet' ? '0' : CLUSTER === 'testnet' ? '86525641' : '6',
      );
    case 'ALGORAND_WAIT_FOR_CONFIRMATIONS':
      return CLUSTER === 'mainnet' ? 4 : CLUSTER === 'testnet' ? 4 : 1;

    case 'ALEPHIUM_MESSAGE_FEE':
      return CLUSTER === 'mainnet'
        ? BigInt(alephiumMainnetConfig.messageFee)
        : CLUSTER === 'testnet'
        ? BigInt(alephiumTestnetConfig.messageFee)
        : BigInt(alephiumDevnetConfig.messageFee);
    case 'ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID':
      return CLUSTER === 'mainnet'
        ? alephiumMainnetConfig.contracts.tokenBridge
        : CLUSTER === 'testnet'
        ? alephiumTestnetConfig.contracts.tokenBridge
        : alephiumDevnetConfig.contracts.tokenBridge;
    case 'ALEPHIUM_BRIDGE_REWARD_ROUTER_ID':
      return CLUSTER === 'mainnet'
        ? alephiumMainnetConfig.contracts.bridgeRewardRouter
        : CLUSTER === 'testnet'
        ? alephiumTestnetConfig.contracts.bridgeRewardRouter
        : alephiumDevnetConfig.contracts.bridgeRewardRouter;

    case 'ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL':
      return CLUSTER === 'mainnet'
        ? MAINNET_ALPH_MINIMAL_CONSISTENCY_LEVEL
        : CLUSTER === 'testnet'
        ? TESTNET_ALPH_MINIMAL_CONSISTENCY_LEVEL
        : DEVNET_ALPH_MINIMAL_CONSISTENCY_LEVEL;

    case 'ALEPHIUM_NETWORK_ID':
      return CLUSTER === 'mainnet'
        ? alephiumMainnetConfig.networkId
        : CLUSTER === 'testnet'
        ? alephiumTestnetConfig.networkId
        : alephiumDevnetConfig.networkId;
    case 'ALEPHIUM_BRIDGE_GROUP_INDEX':
      return CLUSTER === 'mainnet'
        ? alephiumMainnetConfig.groupIndex
        : CLUSTER === 'testnet'
        ? alephiumTestnetConfig.groupIndex
        : alephiumDevnetConfig.groupIndex;
    case 'ALEPHIUM_TOKEN_LIST':
      return CLUSTER === 'mainnet'
        ? mainnetTokensMetadata.tokens
        : CLUSTER === 'testnet'
        ? testnetTokensMetadata.tokens
        : (EMPTY_ARRAY as TokenInfo[]);
    case 'ALEPHIUM_POLLING_INTERVAL':
      return CLUSTER === 'mainnet'
        ? 10000
        : CLUSTER === 'testnet'
        ? 10000
        : 1000;

    case 'COVALENT_BSC':
      return CLUSTER === 'devnet' ? 56 : getConst('BSC_NETWORK_CHAIN_ID');
    case 'COVALENT_POLYGON':
      return CLUSTER === 'devnet' ? 137 : getConst('POLYGON_NETWORK_CHAIN_ID');
    case 'COVALENT_AVAX':
      return CLUSTER === 'devnet' ? 137 : getConst('AVAX_NETWORK_CHAIN_ID');
    case 'COVALENT_FANTOM':
      return CLUSTER === 'devnet' ? 250 : getConst('FANTOM_NETWORK_CHAIN_ID');
    case 'COVALENT_KLAYTN':
      return CLUSTER === 'mainnet' ? getConst('KLAYTN_NETWORK_CHAIN_ID') : null;
    case 'COVALENT_CELO':
      return CLUSTER === 'devnet' ? null : null;
    case 'COVALENT_NEON':
      return CLUSTER === 'devnet' ? null : null;

    case 'WETH_ADDRESS':
      return CLUSTER === 'mainnet'
        ? ethereumMainnetConfig.contracts.wrappedNative
        : CLUSTER === 'testnet'
        ? ethereumTestnetConfig.contracts.wrappedNative
        : ethereumDevnetConfig.contracts.wrappedNative;
    case 'WBNB_ADDRESS':
      return CLUSTER === 'mainnet'
        ? bscMainnetConfig.contracts.wrappedNative
        : CLUSTER === 'testnet'
        ? bscTestnetConfig.contracts.wrappedNative
        : bscDevnetConfig.contracts.wrappedNative;
    case 'WMATIC_ADDRESS':
      return CLUSTER === 'mainnet'
        ? '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270'
        : CLUSTER === 'testnet'
        ? '0x9c3c9283d3e44854697cd22d3faa240cfb032889'
        : '0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E';
    case 'ROPSTEN_WETH_ADDRESS':
      return CLUSTER === 'mainnet'
        ? '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'
        : CLUSTER === 'testnet'
        ? '0xc778417e063141139fce010982780140aa0cd5ab'
        : '0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E';
    case 'WAVAX_ADDRESS':
      return CLUSTER === 'mainnet'
        ? '0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7'
        : CLUSTER === 'testnet'
        ? '0xd00ae08403b9bbb9124bb305c09058e32c39a48c'
        : '0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E';
    case 'WROSE_ADDRESS':
      return CLUSTER === 'mainnet'
        ? '0x21C718C22D52d0F3a789b752D4c2fD5908a8A733'
        : CLUSTER === 'testnet'
        ? '0x792296e2a15e6Ceb5f5039DecaE7A1f25b00B0B0'
        : '0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E';
    case 'WETH_AURORA_ADDRESS':
      return CLUSTER === 'mainnet'
        ? '0xC9BdeEd33CD01541e1eeD10f90519d2C06Fe3feB'
        : CLUSTER === 'testnet'
        ? '0x9D29f395524B3C817ed86e2987A14c1897aFF849'
        : '0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E';
    case 'WFTM_ADDRESS':
      return CLUSTER === 'mainnet'
        ? '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83'
        : CLUSTER === 'testnet'
        ? '0xf1277d1Ed8AD466beddF92ef448A132661956621'
        : '0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E';
    case 'KAR_ADDRESS':
      return CLUSTER === 'mainnet'
        ? '0x0000000000000000000100000000000000000080'
        : CLUSTER === 'testnet'
        ? '0x0000000000000000000100000000000000000080'
        : '0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E';
    case 'ACA_ADDRESS':
      return CLUSTER === 'mainnet'
        ? '0x0000000000000000000100000000000000000000'
        : CLUSTER === 'testnet'
        ? '0x0000000000000000000100000000000000000000'
        : '0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E';
    case 'WKLAY_ADDRESS':
      return CLUSTER === 'mainnet'
        ? '0xe4f05a66ec68b54a58b17c22107b02e0232cc817'
        : CLUSTER === 'testnet'
        ? '0x762ac6e8183db5a8e912a66fcc1a09f5a7ac96a9'
        : '0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E';
    case 'CELO_ADDRESS':
      return CLUSTER === 'mainnet'
        ? '0x471ece3750da237f93b8e339c536989b8978a438'
        : CLUSTER === 'testnet'
        ? '0xF194afDf50B03e69Bd7D057c1Aa9e10c9954E4C9'
        : '0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E';
    case 'WNEON_ADDRESS':
      return CLUSTER === 'mainnet'
        ? '0xf8ad328e98f85fccbf09e43b16dcbbda7e84beab'
        : CLUSTER === 'testnet'
        ? '0xf8aD328E98f85fccbf09E43B16dcbbda7E84BEAB'
        : '0xDDb64fE46a91D46ee29420539FC25FD07c5FEa3E';
    case 'WORMHOLE_V1_ETH_ADDRESS':
      return CLUSTER === 'mainnet'
        ? '0xf92cD566Ea4864356C5491c177A430C222d7e678'
        : CLUSTER === 'testnet'
        ? '0xdae0Cba01eFc4bfEc1F7Fece73Fe8b8d2Eda65B0'
        : '0xf92cD566Ea4864356C5491c177A430C222d7e678';
    case 'WORMHOLE_V1_SOLANA_ADDRESS':
      return CLUSTER === 'mainnet'
        ? 'WormT3McKhFJ2RkiGpdw9GKvNCrB2aB54gb2uV9MfQC'
        : CLUSTER === 'testnet'
        ? 'BrdgiFmZN3BKkcY3danbPYyxPKwb8RhQzpM2VY5L97ED'
        : '';
    case 'WORMHOLE_V1_MINT_AUTHORITY':
      return CLUSTER === 'mainnet'
        ? '9zyPU1mjgzaVyQsYwKJJ7AhVz5bgx5uc1NPABvAcUXsT'
        : CLUSTER === 'testnet'
        ? 'BJa7dq3bRP216zaTdw4cdcV71WkPc1HXvmnGeFVDi5DC'
        : '';
    case 'BSC_MARKET_WARNINGS':
      return CLUSTER === 'mainnet'
        ? MAINNET_BSC_MARKET_WARNINGS
        : CLUSTER === 'testnet'
        ? TESTNET_BSC_MARKET_WARNINGS
        : DEVNET_BSC_MARKET_WARNINGS;

    case 'MIGRATION_PROGRAM_ADDRESS':
      return CLUSTER === 'mainnet'
        ? 'whmRZnmyxdr2TkHXcZoFdtvNYRLQ5Jtbkf6ZbGkJjdk'
        : CLUSTER === 'testnet'
        ? ''
        : 'Ex9bCdVMSfx7EzB3pgSi2R4UHwJAXvTw18rBQm5YQ8gK';

    case 'ETH_MIGRATION_ASSET_MAP':
      return CLUSTER === 'mainnet'
        ? MAINNET_ETH_MIGRATION_ASSET_MAP
        : TESTNET_ETH_MIGRATION_ASSET_MAP;

    case 'MIGRATION_ASSET_MAP':
      return CLUSTER === 'mainnet'
        ? MAINNET_MIGRATION_ASSET_MAP
        : CLUSTER === 'testnet'
        ? TESTNET_MIGRATION_ASSET_MAP
        : DEVNET_MIGRATION_ASSET_MAP;

    case 'MULTI_CHAIN_TOKENS':
      //EVM chains should format the addresses to all lowercase
      return CLUSTER === 'mainnet'
        ? MAINNET_MULTI_CHAIN_TOKENS
        : TESTNET_MULTI_CHAIN_TOKENS;

    case 'RELAYER_INFO_URL':
      return CLUSTER === 'mainnet'
        ? ''
        : CLUSTER === 'testnet'
        ? ''
        : '/relayerExample.json';
    // also for karura
    case 'ACALA_RELAYER_URL':
      return CLUSTER === 'mainnet'
        ? 'https://relayer.aca-api.network'
        : CLUSTER === 'testnet'
        ? 'https://relayer.aca-dev.network'
        : // ? "http://localhost:3111"
          '';

    case 'ACALA_RELAY_URL':
      return `${getConst('ACALA_RELAYER_URL')}/relay`;
    case 'ACALA_SHOULD_RELAY_URL':
      return `${getConst('ACALA_RELAYER_URL')}/shouldRelay`;
  }
};

export const COMING_SOON_CHAINS: ChainInfo[] = [];
export const getDefaultNativeCurrencySymbol = (chainId: ChainId) =>
  chainId === CHAIN_ID_SOLANA
    ? 'SOL'
    : chainId === CHAIN_ID_ETH || chainId === CHAIN_ID_ETHEREUM_ROPSTEN
    ? 'ETH'
    : chainId === CHAIN_ID_BSC
    ? 'BNB'
    : chainId === CHAIN_ID_TERRA
    ? 'LUNC'
    : chainId === CHAIN_ID_POLYGON
    ? 'MATIC'
    : chainId === CHAIN_ID_AVAX
    ? 'AVAX'
    : chainId === CHAIN_ID_OASIS
    ? 'ROSE'
    : chainId === CHAIN_ID_ALGORAND
    ? 'ALGO'
    : chainId === CHAIN_ID_AURORA
    ? 'ETH'
    : chainId === CHAIN_ID_FANTOM
    ? 'FTM'
    : chainId === CHAIN_ID_KARURA
    ? 'KAR'
    : chainId === CHAIN_ID_ACALA
    ? 'ACA'
    : chainId === CHAIN_ID_KLAYTN
    ? 'KLAY'
    : chainId === CHAIN_ID_CELO
    ? 'CELO'
    : chainId === CHAIN_ID_NEON
    ? 'NEON'
    : chainId === CHAIN_ID_ALEPHIUM
    ? 'ALPH'
    : '';

export const getDefaultNativeCurrencyAddressEvm = (chainId: ChainId) => {
  return chainId === CHAIN_ID_ETH
    ? getConst('WETH_ADDRESS')
    : chainId === CHAIN_ID_BSC
    ? getConst('WBNB_ADDRESS')
    : chainId === CHAIN_ID_POLYGON
    ? getConst('WMATIC_ADDRESS')
    : chainId === CHAIN_ID_ETHEREUM_ROPSTEN
    ? getConst('ROPSTEN_WETH_ADDRESS')
    : chainId === CHAIN_ID_AVAX
    ? getConst('WAVAX_ADDRESS')
    : chainId === CHAIN_ID_OASIS
    ? getConst('WROSE_ADDRESS')
    : chainId === CHAIN_ID_AURORA
    ? getConst('WETH_AURORA_ADDRESS')
    : chainId === CHAIN_ID_FANTOM
    ? getConst('WFTM_ADDRESS')
    : chainId === CHAIN_ID_KARURA
    ? getConst('KAR_ADDRESS')
    : chainId === CHAIN_ID_ACALA
    ? getConst('ACA_ADDRESS')
    : chainId === CHAIN_ID_KLAYTN
    ? getConst('WKLAY_ADDRESS')
    : chainId === CHAIN_ID_CELO
    ? getConst('CELO_ADDRESS')
    : chainId === CHAIN_ID_NEON
    ? getConst('WNEON_ADDRESS')
    : '';
};

export const getExplorerName = (chainId: ChainId) =>
  chainId === CHAIN_ID_ETH || chainId === CHAIN_ID_ETHEREUM_ROPSTEN
    ? 'Etherscan'
    : chainId === CHAIN_ID_BSC
    ? 'BscScan'
    : chainId === CHAIN_ID_TERRA
    ? 'Finder'
    : chainId === CHAIN_ID_POLYGON
    ? 'Polygonscan'
    : chainId === CHAIN_ID_AVAX
    ? 'Snowtrace'
    : chainId === CHAIN_ID_ALGORAND
    ? 'AlgoExplorer'
    : chainId === CHAIN_ID_FANTOM
    ? 'FTMScan'
    : chainId === CHAIN_ID_KLAYTN
    ? 'Klaytnscope'
    : chainId === CHAIN_ID_SOLANA
    ? 'Solscan'
    : 'Explorer';

export const getEvmChainId = (chainId: ChainId) =>
  chainId === CHAIN_ID_ETH
    ? getConst('ETH_NETWORK_CHAIN_ID')
    : chainId === CHAIN_ID_ETHEREUM_ROPSTEN
    ? getConst('ROPSTEN_ETH_NETWORK_CHAIN_ID')
    : chainId === CHAIN_ID_BSC
    ? getConst('BSC_NETWORK_CHAIN_ID')
    : chainId === CHAIN_ID_POLYGON
    ? getConst('POLYGON_NETWORK_CHAIN_ID')
    : chainId === CHAIN_ID_AVAX
    ? getConst('AVAX_NETWORK_CHAIN_ID')
    : chainId === CHAIN_ID_OASIS
    ? getConst('OASIS_NETWORK_CHAIN_ID')
    : chainId === CHAIN_ID_AURORA
    ? getConst('AURORA_NETWORK_CHAIN_ID')
    : chainId === CHAIN_ID_FANTOM
    ? getConst('FANTOM_NETWORK_CHAIN_ID')
    : chainId === CHAIN_ID_KARURA
    ? getConst('KARURA_NETWORK_CHAIN_ID')
    : chainId === CHAIN_ID_ACALA
    ? getConst('ACALA_NETWORK_CHAIN_ID')
    : chainId === CHAIN_ID_KLAYTN
    ? getConst('KLAYTN_NETWORK_CHAIN_ID')
    : chainId === CHAIN_ID_CELO
    ? getConst('CELO_NETWORK_CHAIN_ID')
    : chainId === CHAIN_ID_NEON
    ? getConst('NEON_NETWORK_CHAIN_ID')
    : undefined;

export const SOL_CUSTODY_ADDRESS =
  'GugU1tP7doLeTw9hQP51xRJyS8Da1fWxuiy2rVrnMD2m';
export const SOL_NFT_CUSTODY_ADDRESS =
  'D63bhHo634eXSj4Jq3xgu2fjB5XKc8DFHzDY9iZk7fv1';
export const TERRA_TEST_TOKEN_ADDRESS =
  'terra13nkgqrfymug724h8pprpexqj9h629sa3ncw7sh';

export const WALLET_CONNECT_ALPH_PROJECT_ID =
  '6e2562e43678dd68a9070a62b6d52207';

export const ALEPHIUM_REMOTE_TOKEN_POOL_CODE_HASH =
  alephium_contracts.RemoteTokenPool.contract.codeHash;

export const ALEPHIUM_ATTEST_TOKEN_CONSISTENCY_LEVEL = 10;

export const getBridgeAddressForChain = (chainId: ChainId) =>
  chainId === CHAIN_ID_SOLANA
    ? getConst('SOL_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_ETH
    ? getConst('ETH_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_BSC
    ? getConst('BSC_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_POLYGON
    ? getConst('POLYGON_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_ETHEREUM_ROPSTEN
    ? getConst('ROPSTEN_ETH_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_AVAX
    ? getConst('AVAX_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_OASIS
    ? getConst('OASIS_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_AURORA
    ? getConst('AURORA_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_FANTOM
    ? getConst('FANTOM_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_ALEPHIUM
    ? getConst('ALEPHIUM_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_KARURA
    ? getConst('KARURA_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_KLAYTN
    ? getConst('KLAYTN_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_CELO
    ? getConst('CELO_BRIDGE_ADDRESS')
    : '';
export const getNFTBridgeAddressForChain = (chainId: ChainId) =>
  chainId === CHAIN_ID_SOLANA
    ? getConst('SOL_NFT_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_ETH
    ? getConst('ETH_NFT_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_BSC
    ? getConst('BSC_NFT_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_POLYGON
    ? getConst('POLYGON_NFT_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_ETHEREUM_ROPSTEN
    ? getConst('ROPSTEN_ETH_NFT_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_AVAX
    ? getConst('AVAX_NFT_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_OASIS
    ? getConst('OASIS_NFT_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_AURORA
    ? getConst('AURORA_NFT_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_FANTOM
    ? getConst('FANTOM_NFT_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_KARURA
    ? getConst('KARURA_NFT_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_KLAYTN
    ? getConst('KLAYTN_NFT_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_CELO
    ? getConst('CELO_NFT_BRIDGE_ADDRESS')
    : '';
export const getTokenBridgeAddressForChain = (chainId: ChainId) =>
  chainId === CHAIN_ID_SOLANA
    ? getConst('SOL_TOKEN_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_ETH
    ? getConst('ETH_TOKEN_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_BSC
    ? getConst('BSC_TOKEN_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_POLYGON
    ? getConst('POLYGON_TOKEN_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_ETHEREUM_ROPSTEN
    ? getConst('ROPSTEN_ETH_TOKEN_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_AVAX
    ? getConst('AVAX_TOKEN_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_OASIS
    ? getConst('OASIS_TOKEN_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_AURORA
    ? getConst('AURORA_TOKEN_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_FANTOM
    ? getConst('FANTOM_TOKEN_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_ALEPHIUM
    ? getConst('ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID')
    : chainId === CHAIN_ID_KARURA
    ? getConst('KARURA_TOKEN_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_KLAYTN
    ? getConst('KLAYTN_TOKEN_BRIDGE_ADDRESS')
    : chainId === CHAIN_ID_CELO
    ? getConst('CELO_TOKEN_BRIDGE_ADDRESS')
    : '';

export const COVALENT_API_KEY = process.env.REACT_APP_COVALENT_API_KEY
  ? process.env.REACT_APP_COVALENT_API_KEY
  : '';

export const COVALENT_ETHEREUM = 1; // Covalent only supports mainnet and Kovan

export const COVALENT_GET_TOKENS_URL = (
  chainId: ChainId,
  walletAddress: string,
  nft?: boolean,
  noNftMetadata?: boolean,
) => {
  if (COVALENT_API_KEY === '') {
    return '';
  }
  const chainNum =
    chainId === CHAIN_ID_ETH || chainId === CHAIN_ID_ETHEREUM_ROPSTEN
      ? COVALENT_ETHEREUM
      : chainId === CHAIN_ID_BSC
      ? getConst('COVALENT_BSC')
      : chainId === CHAIN_ID_POLYGON
      ? getConst('COVALENT_POLYGON')
      : chainId === CHAIN_ID_AVAX
      ? getConst('COVALENT_AVAX')
      : chainId === CHAIN_ID_FANTOM
      ? getConst('COVALENT_FANTOM')
      : chainId === CHAIN_ID_KLAYTN
      ? getConst('COVALENT_KLAYTN')
      : chainId === CHAIN_ID_CELO
      ? getConst('COVALENT_CELO')
      : chainId === CHAIN_ID_NEON
      ? getConst('COVALENT_NEON')
      : '';
  // https://www.covalenthq.com/docs/api/#get-/v1/{chain_id}/address/{address}/balances_v2/
  return chainNum
    ? `https://api.covalenthq.com/v1/${chainNum}/address/${walletAddress}/balances_v2/?key=${COVALENT_API_KEY}${
        nft ? '&nft=true' : ''
      }${noNftMetadata ? '&no-nft-fetch=true' : ''}`
    : '';
};

export const TVL_URL =
  'https://europe-west3-wormhole-315720.cloudfunctions.net/mainnet-notionaltvl';
export const TVL_CUMULATIVE_URL =
  'https://europe-west3-wormhole-315720.cloudfunctions.net/mainnet-notionaltvlcumulative?totalsOnly=true';
export const TERRA_SWAPRATE_URL =
  'https://fcd.terra.dev/v1/market/swaprate/uusd';

export const WETH_DECIMALS = 18;

export const WBNB_DECIMALS = 18;

export const WMATIC_DECIMALS = 18;

export const ROPSTEN_WETH_DECIMALS = 18;

export const WAVAX_DECIMALS = 18;

export const WROSE_DECIMALS = 18;

export const WETH_AURORA_DECIMALS = 18;

export const WFTM_DECIMALS = 18;

export const KAR_DECIMALS = 12;

export const ACA_DECIMALS = 12;

export const WKLAY_DECIMALS = 18;

export const CELO_DECIMALS = 18;

export const WNEON_DECIMALS = 18;

export const ALGO_DECIMALS = 6;

export const TERRA_TOKEN_METADATA_URL =
  'https://assets.terra.money/cw20/tokens.json';

// hardcoded addresses for warnings
export const SOLANA_TOKENS_THAT_EXIST_ELSEWHERE = [
  'SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt', //  SRM
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'kinXdEcpDQeHPEuQnqmUgtYykqKGVFq6CeVX5iAHJq6', //  KIN
  'CDJWUqTcYTVAKXAVXoQZFes5JUFc7owSeq7eMQcDSbo5', // renBTC
  '8wv2KAykQstNAj2oW6AHANGBiFKVFhvMiyyzzjhkmGvE', // renLUNA
  'G1a6jxYz3m8DVyMqYnuV7s86wD4fvuXYneWSpLJkmsXj', // renBCH
  'FKJvvVJ242tX7zFtzTmzqoA631LqHh4CdgcN8dcfFSju', // renDGB
  'ArUkYE2XDKzqy77PRRGjo4wREWwqk6RXTfM9NeqzPvjU', // renDOGE
  'E99CQ2gFMmbiyK2bwiaFNWUUmwz4r8k2CVEFxwuvQ7ue', // renZEC
  'De2bU64vsXKU9jq4bCjeDxNRGPn8nr3euaTK8jBYmD3J', // renFIL
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
];
export const ETH_TOKENS_THAT_EXIST_ELSEWHERE = [
  getAddress('0x476c5E26a75bd202a9683ffD34359C0CC15be0fF'), // SRM
  getAddress('0x818fc6c2ec5986bc6e2cbf00939d90556ab12ce5'), // KIN
  getAddress('0xeb4c2781e4eba804ce9a9803c67d0893436bb27d'), // renBTC
  getAddress('0x52d87F22192131636F93c5AB18d0127Ea52CB641'), // renLUNA
  getAddress('0x459086f2376525bdceba5bdda135e4e9d3fef5bf'), // renBCH
  getAddress('0xe3cb486f3f5c639e98ccbaf57d95369375687f80'), // renDGB
  getAddress('0x3832d2F059E55934220881F831bE501D180671A7'), // renDOGE
  getAddress('0x1c5db575e2ff833e46a2e9864c22f4b22e0b37c2'), // renZEC
  getAddress('0xD5147bc8e386d91Cc5DBE72099DAC6C9b99276F5'), // renFIL
];
export const ETH_TOKENS_THAT_CAN_BE_SWAPPED_ON_SOLANA = [
  getAddress('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'), // USDC
  getAddress('0xdac17f958d2ee523a2206206994597c13d831ec7'), // USDT
];

export const BSC_MIGRATION_ASSET_MAP = new Map<string, string>([]);

export const getMigrationAssetMap = (chainId: ChainId) => {
  if (chainId === CHAIN_ID_BSC) {
    return BSC_MIGRATION_ASSET_MAP;
  } else if (chainId === CHAIN_ID_ETH) {
    return getConst('ETH_MIGRATION_ASSET_MAP');
  } else if (chainId === CHAIN_ID_SOLANA) {
    return getConst('MIGRATION_ASSET_MAP');
  } else {
    return new Map<string, string>();
  }
};

export const SUPPORTED_TERRA_TOKENS = ['uluna', 'uusd'];
export const TERRA_DEFAULT_FEE_DENOM = SUPPORTED_TERRA_TOKENS[0];

export const TOTAL_TRANSACTIONS_WORMHOLE = `https://europe-west3-wormhole-315720.cloudfunctions.net/mainnet-totals?groupBy=address`;

export const RECENT_TRANSACTIONS_WORMHOLE = `https://europe-west3-wormhole-315720.cloudfunctions.net/mainnet-recent?groupBy=address&numRows=2`;

export const NOTIONAL_TRANSFERRED_URL =
  'https://europe-west3-wormhole-315720.cloudfunctions.net/mainnet-notionaltransferredfrom';

export const VAA_EMITTER_ADDRESSES = [
  `${CHAIN_ID_SOLANA}:ec7372995d5cc8732397fb0ad35c0121e0eaa90d26f828a534cab54391b3a4f5`, //SOLANA TOKEN
  `${CHAIN_ID_SOLANA}:0def15a24423e1edd1a5ab16f557b9060303ddbab8c803d2ee48f4b78a1cfd6b`, //SOLAN NFT
  `${CHAIN_ID_ETH}:0000000000000000000000003ee18b2214aff97000d974cf647e7c347e8fa585`, //ETH token
  `${CHAIN_ID_ETH}:0000000000000000000000006ffd7ede62328b3af38fcd61461bbfc52f5651fe`, //ETH NFT
  `${CHAIN_ID_TERRA}:0000000000000000000000007cf7b764e38a0a5e967972c1df77d432510564e2`, //terra
  `${CHAIN_ID_BSC}:000000000000000000000000b6f6d86a8f9879a9c87f643768d9efc38c1da6e7`, //bsc
  `${CHAIN_ID_BSC}:0000000000000000000000005a58505a96d1dbf8df91cb21b54419fc36e93fde`, //bsc nft
  `${CHAIN_ID_POLYGON}:0000000000000000000000005a58505a96d1dbf8df91cb21b54419fc36e93fde`, //Polygon
  `${CHAIN_ID_POLYGON}:00000000000000000000000090bbd86a6fe93d3bc3ed6335935447e75fab7fcf`, //Polygon nft
  `${CHAIN_ID_AVAX}:0000000000000000000000000e082f06ff657d94310cb8ce8b0d9a04541d8052`, //AVAX
  `${CHAIN_ID_AVAX}:000000000000000000000000f7b6737ca9c4e08ae573f75a97b73d7a813f5de5`, //AVAX nft
  `${CHAIN_ID_OASIS}:0000000000000000000000005848c791e09901b40a9ef749f2a6735b418d7564`, //Oasis
  `${CHAIN_ID_OASIS}:00000000000000000000000004952D522Ff217f40B5Ef3cbF659EcA7b952a6c1`, //Oasis nft
  `${CHAIN_ID_AURORA}:00000000000000000000000051b5123a7b0F9b2bA265f9c4C8de7D78D52f510F`, //Aurora
  `${CHAIN_ID_AURORA}:0000000000000000000000006dcC0484472523ed9Cdc017F711Bcbf909789284`, //Aurora nft
  `${CHAIN_ID_FANTOM}:0000000000000000000000007C9Fc5741288cDFdD83CeB07f3ea7e22618D79D2`, //Fantom
  `${CHAIN_ID_FANTOM}:000000000000000000000000A9c7119aBDa80d4a4E0C06C8F4d8cF5893234535`, //Fantom nft
  `${CHAIN_ID_KARURA}:000000000000000000000000ae9d7fe007b3327AA64A32824Aaac52C42a6E624`, //Karura
  `${CHAIN_ID_KARURA}:000000000000000000000000b91e3638F82A1fACb28690b37e3aAE45d2c33808`, //Karura nft
];

export const WORMHOLE_EXPLORER_BASE = 'https://wormholenetwork.com/en/explorer';

export type MultiChainInfo = {
  [key in ChainId]?: { [address: string]: string };
};

export const AVAILABLE_MARKETS_URL =
  'https://docs.wormholenetwork.com/wormhole/overview-liquid-markets';

export const SOLANA_SYSTEM_PROGRAM_ADDRESS = '11111111111111111111111111111111';
export const FEATURED_MARKETS_JSON_URL =
  'https://raw.githubusercontent.com/certusone/wormhole-token-list/main/src/markets.json';

export const logoOverrides = new Map<string, string>([
  [
    '0x727f064a78dc734d33eec18d5370aef32ffd46e4',
    'https://orion.money/assets/ORION-LOGO-2.1-GREEN@256x256.png',
  ],
]);

export const getHowToAddTokensToWalletUrl = (chainId: ChainId) => {
  if (isEVMChain(chainId)) {
    return 'https://docs.wormholenetwork.com/wormhole/video-tutorial-how-to-manually-add-tokens-to-your-wallet#1.-metamask-ethereum-polygon-and-bsc';
  } else if (chainId === CHAIN_ID_TERRA) {
    return 'https://docs.wormholenetwork.com/wormhole/video-tutorial-how-to-manually-add-tokens-to-your-wallet#2.-terra-station';
  }
  return '';
};

export const getHowToAddToTokenListUrl = (chainId: ChainId) => {
  if (chainId === CHAIN_ID_SOLANA) {
    return 'https://github.com/solana-labs/token-list';
  } else if (chainId === CHAIN_ID_TERRA) {
    return 'https://github.com/terra-money/assets';
  }
  return '';
};

export const SOLANA_TOKEN_METADATA_PROGRAM_URL =
  'https://github.com/metaplex-foundation/metaplex-program-library/tree/master/token-metadata/program';
export const MAX_VAA_UPLOAD_RETRIES_SOLANA = 5;

export const POLYGON_TERRA_WRAPPED_TOKENS = [
  '0x692597b009d13c4049a947cab2239b7d6517875f', // Wrapped UST Token
  '0x24834bbec7e39ef42f4a75eaf8e5b6486d3f0e57', // Wrapped LUNA Token
];

export const JUPITER_SWAP_BASE_URL = 'https://jup.ag/swap';

export const getIsTransferDisabled = (
  chainId: ChainId,
  isSourceChain: boolean,
) => {
  const disableTransfers = CHAIN_CONFIG_MAP[chainId]?.disableTransfers;
  return disableTransfers === 'from'
    ? isSourceChain
    : disableTransfers === 'to'
    ? !isSourceChain
    : !!disableTransfers;
};

export const LUNA_ADDRESS = 'uluna';
export const UST_ADDRESS = 'uusd';

export type RelayerCompareAsset = {
  [key in ChainId]: string;
};
export const RELAYER_COMPARE_ASSET: RelayerCompareAsset = {
  [CHAIN_ID_SOLANA]: 'solana',
  [CHAIN_ID_ETH]: 'ethereum',
  [CHAIN_ID_TERRA]: 'terra-luna',
  [CHAIN_ID_BSC]: 'binancecoin',
  [CHAIN_ID_POLYGON]: 'matic-network',
  [CHAIN_ID_AVAX]: 'avalanche-2',
  [CHAIN_ID_OASIS]: 'oasis-network',
  [CHAIN_ID_FANTOM]: 'fantom',
  [CHAIN_ID_AURORA]: 'ethereum', // Aurora uses bridged ether
  [CHAIN_ID_KLAYTN]: 'klay-token',
  [CHAIN_ID_CELO]: 'celo',
  [CHAIN_ID_ALEPHIUM]: 'alephium',
} as RelayerCompareAsset;
export const getCoinGeckoURL = (coinGeckoId: string) =>
  `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoId}&vs_currencies=usd`;

export const RELAY_URL_EXTENSION = '/relayvaa/';

export const getChainShortName = (chainId: ChainId) => {
  return chainId === CHAIN_ID_BSC
    ? 'BSC'
    : getConst('CHAINS_BY_ID')[chainId]?.name;
};

export const COLOR_BY_CHAIN_ID: { [key in ChainId]?: string } = {
  [CHAIN_ID_SOLANA]: '#31D7BB',
  [CHAIN_ID_ETH]: '#8A92B2',
  [CHAIN_ID_TERRA]: '#5493F7',
  [CHAIN_ID_BSC]: '#F0B90B',
  [CHAIN_ID_POLYGON]: '#8247E5',
  [CHAIN_ID_AVAX]: '#E84142',
  [CHAIN_ID_OASIS]: '#0092F6',
  [CHAIN_ID_AURORA]: '#23685A',
  [CHAIN_ID_FANTOM]: '#1969FF',
  [CHAIN_ID_KARURA]: '#FF4B3B',
  [CHAIN_ID_ACALA]: '#E00F51',
  [CHAIN_ID_ALEPHIUM]: '#8A92B2',
};

export const DISABLED_TOKEN_TRANSFERS: { [key in ChainId]?: string[] } = {
  [CHAIN_ID_KARURA]: [
    '0x0000000000000000000100000000000000000081', // aUSD
  ],
};
export const getIsTokenTransferDisabled = (
  chainId: ChainId,
  tokenAddress: string,
) => {
  return !!DISABLED_TOKEN_TRANSFERS[chainId]?.includes(tokenAddress);
};

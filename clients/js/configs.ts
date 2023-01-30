import { ChainName } from "alephium-wormhole-sdk";
import { default as alephiumDevnetConfig } from '../../configs/alephium/devnet.json'
import { default as alephiumTestnetConfig } from '../../configs/alephium/testnet.json'
import { default as alephiumMainnetConfig } from '../../configs/alephium/mainnet.json'
import { default as ethereumDevnetConfig } from '../../configs/ethereum/devnet.json'
import { default as ethereumTestnetConfig } from '../../configs/ethereum/testnet.json'
import { default as ethereumMainnetConfig } from '../../configs/ethereum/mainnet.json'
import { default as guardianDevnetConfig } from '../../configs/guardian/devnet.json'
import { default as guardianTestnetConfig } from '../../configs/guardian/testnet.json'
import { default as guardianMainnetConfig } from '../../configs/guardian/mainnet.json'

require("dotenv").config({ path: `${process.env.HOME}/.wormhole/.env` });

function get_env_var(env: string): string | undefined {
  const v = process.env[env];
  return v;
}

export type Connection = {
  rpc: string | undefined;
  key: string | undefined;
};

export type ChainConnections = {
  [chain in ChainName]: Connection;
};

const MAINNET = {
  unset: {
    rpc: undefined,
    key: undefined,
  },
  solana: {
    rpc: "https://api.mainnet-beta.solana.com",
    key: get_env_var("SOLANA_KEY"),
  },
  terra: {
    rpc: "https://lcd.terra.dev",
    chain_id: "columbus-5",
    key: get_env_var("TERRA_MNEMONIC"),
  },
  ethereum: {
    rpc: `${ethereumMainnetConfig.nodeUrl}${get_env_var("INFURA_KEY")}`,
    key: get_env_var("ETH_KEY"),
    tokenBridgeAddress: `${ethereumMainnetConfig.contracts.tokenBridge}`,
    governanceAddress: `${ethereumMainnetConfig.contracts.governance}`
  },
  bsc: {
    rpc: "https://bsc-dataseed.binance.org/",
    key: get_env_var("ETH_KEY"),
  },
  polygon: {
    rpc: "https://polygon-rpc.com",
    key: get_env_var("ETH_KEY"),
  },
  avalanche: {
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    key: get_env_var("ETH_KEY"),
  },
  algorand: {
    rpc: undefined,
    key: undefined,
  },
  oasis: {
    rpc: "https://emerald.oasis.dev/",
    key: get_env_var("ETH_KEY"),
  },
  fantom: {
    rpc: "https://rpc.ftm.tools/",
    key: get_env_var("ETH_KEY"),
  },
  aurora: {
    rpc: "https://mainnet.aurora.dev",
    key: get_env_var("ETH_KEY"),
  },
  karura: {
    rpc: "https://eth-rpc-karura.aca-api.network/",
    key: get_env_var("ETH_KEY"),
  },
  acala: {
    rpc: "https://eth-rpc-acala.aca-api.network/",
    key: get_env_var("ETH_KEY"),
  },
  klaytn: {
    rpc: "https://public-node-api.klaytnapi.com/v1/cypress",
    key: get_env_var("ETH_KEY"),
  },
  celo: {
    rpc: "https://forno.celo.org",
    key: get_env_var("ETH_KEY"),
  },
  near: {
    rpc: undefined,
    key: undefined,
  },
  moonbeam: {
    rpc: undefined,
    key: undefined,
  },
  neon: {
    rpc: undefined,
    key: undefined,
  },
  ropsten: {
    rpc: `https://ropsten.infura.io/v3/${get_env_var("INFURA_KEY")}`,
    key: get_env_var("ETH_KEY"),
  },
  alephium: {
    rpc: alephiumMainnetConfig.nodeUrl,
    key: get_env_var('ALPH_KEY'),
    tokenBridgeAddress: alephiumMainnetConfig.contracts.tokenBridge,
    governanceAddress: alephiumMainnetConfig.contracts.governance,
    groupIndex: alephiumMainnetConfig.groupIndex,
  }
};

const TESTNET = {
  unset: {
    rpc: undefined,
    key: undefined,
  },
  solana: {
    rpc: "https://api.devnet.solana.com",
    key: get_env_var("SOLANA_KEY"),
  },
  terra: {
    rpc: "https://bombay-lcd.terra.dev",
    chain_id: "bombay-12",
    key: get_env_var("TERRA_MNEMONIC"),
  },
  ethereum: {
    rpc: `${ethereumTestnetConfig.nodeUrl}${get_env_var("INFURA_KEY")}`,
    key: get_env_var("ETH_KEY"),
    tokenBridgeAddress: `${ethereumTestnetConfig.contracts.tokenBridge}`,
    governanceAddress: `${ethereumTestnetConfig.contracts.governance}`
  },
  bsc: {
    rpc: "https://data-seed-prebsc-1-s1.binance.org:8545",
    key: get_env_var("ETH_KEY"),
  },
  polygon: {
    rpc: `https://polygon-mumbai.infura.io/v3/${get_env_var("INFURA_KEY")}`,
    key: get_env_var("ETH_KEY"),
  },
  avalanche: {
    rpc: "https://api.avax-test.network/ext/bc/C/rpc",
    key: get_env_var("ETH_KEY"),
  },
  oasis: {
    rpc: "https://testnet.emerald.oasis.dev",
    key: get_env_var("ETH_KEY"),
  },
  algorand: {
    rpc: undefined,
    key: undefined,
  },
  fantom: {
    rpc: "https://rpc.testnet.fantom.network",
    key: get_env_var("ETH_KEY"),
  },
  aurora: {
    rpc: "https://testnet.aurora.dev",
    key: get_env_var("ETH_KEY"),
  },
  karura: {
    rpc: "http://103.253.145.222:8545",
    key: get_env_var("ETH_KEY"),
  },
  acala: {
    rpc: "http://157.245.252.103:8545",
    key: get_env_var("ETH_KEY"),
  },
  klaytn: {
    rpc: "https://api.baobab.klaytn.net:8651",
    key: get_env_var("ETH_KEY"),
  },
  celo: {
    rpc: "https://alfajores-forno.celo-testnet.org",
    key: get_env_var("ETH_KEY"),
  },
  near: {
    rpc: undefined,
    key: undefined,
  },
  moonbeam: {
    rpc: "https://rpc.api.moonbase.moonbeam.network",
    key: get_env_var("ETH_KEY"),
  },
  neon: {
    rpc: "https://proxy.devnet.neonlabs.org/solana",
    key: get_env_var("ETH_KEY"),
  },
  ropsten: {
    rpc: `https://ropsten.infura.io/v3/${get_env_var("INFURA_KEY")}`,
    key: get_env_var("ETH_KEY"),
  },
  alephium: {
    rpc: alephiumTestnetConfig.nodeUrl,
    key: get_env_var('ALPH_KEY'),
    tokenBridgeAddress: alephiumTestnetConfig.contracts.tokenBridge,
    governanceAddress: alephiumTestnetConfig.contracts.governance,
    groupIndex: alephiumTestnetConfig.groupIndex
  }
};

const DEVNET = {
  unset: {
    rpc: undefined,
    key: undefined,
  },
  solana: {
    rpc: "http://localhost:8899",
    key: "J2D4pwDred8P9ioyPEZVLPht885AeYpifsFGUyuzVmiKQosAvmZP4EegaKFrSprBC5vVP1xTvu61vYDWsxBNsYx",
  },
  terra: {
    rpc: "http://localhost:1317",
    chain_id: "columbus-5",
    key: "notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius",
  },
  ethereum: {
    rpc: "http://localhost:8545",
    key: "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
    tokenBridgeAddress: `${ethereumDevnetConfig.contracts.tokenBridge}`,
    governanceAddress: `${ethereumDevnetConfig.contracts.governance}`
  },
  bsc: {
    rpc: "http://localhost:8546",
    key: "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
  },
  polygon: {
    rpc: undefined,
    key: undefined,
  },
  avalanche: {
    rpc: undefined,
    key: undefined,
  },
  oasis: {
    rpc: undefined,
    key: undefined,
  },
  algorand: {
    rpc: undefined,
    key: undefined,
  },
  fantom: {
    rpc: undefined,
    key: undefined,
  },
  aurora: {
    rpc: undefined,
    key: undefined,
  },
  karura: {
    rpc: undefined,
    key: undefined,
  },
  acala: {
    rpc: undefined,
    key: undefined,
  },
  klaytn: {
    rpc: undefined,
    key: undefined,
  },
  celo: {
    rpc: undefined,
    key: undefined,
  },
  near: {
    rpc: undefined,
    key: undefined,
  },
  moonbeam: {
    rpc: undefined,
    key: undefined,
  },
  neon: {
    rpc: undefined,
    key: undefined,
  },
  ropsten: {
    rpc: undefined,
    key: undefined,
  },
  alephium: {
    rpc: alephiumDevnetConfig.nodeUrl,
    key: alephiumDevnetConfig.mnemonic,
    tokenBridgeAddress: alephiumDevnetConfig.contracts.tokenBridge,
    governanceAddress: alephiumDevnetConfig.contracts.governance,
    groupIndex: alephiumDevnetConfig.groupIndex
  }
};

export const Guardians = {
  DEVNET: {
    governanceEmitterAddress: guardianDevnetConfig.governanceEmitterAddress,
    governanceChainId: guardianDevnetConfig.governanceChainId,
    guardianUrls: guardianDevnetConfig.guardianUrls
  },
  TESTNET: {
    governanceEmitterAddress: guardianTestnetConfig.governanceEmitterAddress,
    governanceChainId: guardianTestnetConfig.governanceChainId,
    guardianUrls: guardianTestnetConfig.guardianUrls
  },
  MAINNET: {
    governanceEmitterAddress: guardianMainnetConfig.governanceEmitterAddress,
    governanceChainId: guardianMainnetConfig.governanceChainId,
    guardianUrls: guardianMainnetConfig.guardianUrls
  }
}

/**
 *
 * If you get a type error here, it means that a chain you just added does not
 * have an entry in TESTNET.
 * This is implemented as an ad-hoc type assertion instead of a type annotation
 * on TESTNET so that e.g.
 *
 * ```typescript
 * TESTNET['solana'].rpc
 * ```
 * has type 'string' instead of 'string | undefined'.
 *
 * (Do not delete this declaration!)
 */
const isTestnetConnections: ChainConnections = TESTNET;

/**
 *
 * See [[isTestnetContracts]]
 */
const isMainnetConnections: ChainConnections = MAINNET;

/**
 *
 * See [[isTestnetContracts]]
 */
const isDevnetConnections: ChainConnections = DEVNET;

export const CONFIGS = { MAINNET, TESTNET, DEVNET };

export type NetworkType = 'MAINNET' | 'TESTNET' | 'DEVNET'

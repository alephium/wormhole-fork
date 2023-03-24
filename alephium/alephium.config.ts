import { Configuration } from '@alephium/cli'
import { default as alephiumDevnetConfig } from '../configs/alephium/devnet.json'
import { default as alephiumTestnetConfig } from '../configs/alephium/testnet.json'
import { default as alephiumMainnetConfig } from '../configs/alephium/mainnet.json'
import { default as guardianDevnetConfig } from '../configs/guardian/devnet.json'
import { default as guardianTestnetConfig } from '../configs/guardian/testnet.json'
import { default as guardianMainnetConfig } from '../configs/guardian/mainnet.json'

export type Settings = {
  nodeUrl: string
  networkId: number
  initSigners: string[]
  chainId: number
  governanceChainId: number
  governanceEmitterAddress: string
  minimalConsistencyLevel: number
  messageFee: bigint
}

function loadSettings(network: 'devnet' | 'testnet' | 'mainnet'): Settings {
  const [alephiumConfig, guardianConfig] =
    network === 'devnet'
      ? [alephiumDevnetConfig, guardianDevnetConfig]
      : network === 'testnet'
      ? [alephiumTestnetConfig, guardianTestnetConfig]
      : [alephiumMainnetConfig, guardianMainnetConfig]
  return {
    nodeUrl: alephiumConfig.nodeUrl,
    networkId: alephiumConfig.networkId,
    initSigners: guardianConfig.initSigners as string[],
    chainId: alephiumConfig.chainId as number,
    governanceChainId: guardianConfig.governanceChainId as number,
    governanceEmitterAddress: guardianConfig.governanceEmitterAddress as string,
    minimalConsistencyLevel: alephiumConfig.minimalConsistencyLevel as number,
    messageFee: BigInt(alephiumConfig.messageFee)
  }
}

const devnetSettings = loadSettings('devnet')
const testnetSettings = loadSettings('testnet')
const mainnetSettings = loadSettings('mainnet')

const configuration: Configuration<Settings> = {
  deploymentScriptDir: 'scripts',
  compilerOptions: {
    errorOnWarnings: true,
    ignoreUnusedConstantsWarnings: true
  },

  defaultNetwork: 'devnet',
  networks: {
    devnet: {
      networkId: devnetSettings.networkId,
      nodeUrl: devnetSettings.nodeUrl,
      privateKeys: ['a642942e67258589cd2b1822c631506632db5a12aabcf413604e785300d762a5'],
      confirmations: 1,
      settings: devnetSettings
    },

    testnet: {
      networkId: testnetSettings.networkId,
      nodeUrl: testnetSettings.nodeUrl,
      privateKeys: process.env.PRIVATE_KEYS === undefined ? [] : process.env.PRIVATE_KEYS.split(','),
      confirmations: 2,
      settings: testnetSettings
    },

    mainnet: {
      networkId: mainnetSettings.networkId,
      nodeUrl: mainnetSettings.nodeUrl,
      privateKeys: process.env.PRIVATE_KEYS === undefined ? [] : process.env.PRIVATE_KEYS.split(','),
      confirmations: 2,
      settings: mainnetSettings
    }
  }
}

export default configuration

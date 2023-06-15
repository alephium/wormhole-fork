import { Configuration } from '@alephium/cli'
import { testPrivateKey } from '@alephium/web3-test'
import { default as alephiumDevnetConfig } from '../configs/alephium/devnet.json'
import { default as alephiumTestnetConfig } from '../configs/alephium/testnet.json'
import { default as alephiumMainnetConfig } from '../configs/alephium/mainnet.json'
import { default as guardianDevnetConfig } from '../configs/guardian/devnet.json'
import { default as guardianTestnetConfig } from '../configs/guardian/testnet.json'
import { default as guardianMainnetConfig } from '../configs/guardian/mainnet.json'
import { ONE_ALPH } from '@alephium/web3'

export type Settings = {
  nodeUrl: string
  networkId: number
  initSigners: string[]
  chainId: number
  governanceChainId: number
  governanceEmitterAddress: string
  minimalConsistencyLevel: number
  messageFee: bigint
  initRewards: bigint
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
    messageFee: BigInt(alephiumConfig.messageFee),
    initRewards: BigInt(alephiumConfig.initRewards) * ONE_ALPH
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

  networks: {
    devnet: {
      networkId: devnetSettings.networkId,
      nodeUrl: process.env.NODE_URL ?? devnetSettings.nodeUrl,
      privateKeys: [testPrivateKey],
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

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
  artifactDir: '../sdk/js/src/alephium/artifacts',

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
      mnemonic:
        'vault alarm sad mass witness property virus style good flower rice alpha viable evidence run glare pretty scout evil judge enroll refuse another lava',
      confirmations: 1,
      settings: devnetSettings
    },

    testnet: {
      networkId: testnetSettings.networkId,
      nodeUrl: testnetSettings.nodeUrl,
      mnemonic: process.env.MNEMONIC as string,
      confirmations: 2,
      settings: testnetSettings
    },

    mainnet: {
      networkId: mainnetSettings.networkId,
      nodeUrl: mainnetSettings.nodeUrl,
      mnemonic: process.env.MNEMONIC as string,
      confirmations: 2,
      settings: mainnetSettings
    }
  }
}

export default configuration

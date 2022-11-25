import { Configuration } from '@alephium/cli'
import { default as alephiumDevnetConfig } from '../configs/alephium/devnet.json'
import { default as alephiumTestnetConfig } from '../configs/alephium/testnet.json'
import { default as alephiumMainnetConfig } from '../configs/alephium/mainnet.json'
import { default as guardianDevnetConfig } from '../configs/guardian/devnet.json'
import { default as guardianTestnetConfig } from '../configs/guardian/testnet.json'
import { default as guardianMainnetConfig } from '../configs/guardian/mainnet.json'

export type Settings = {
  initSigners: string[]
  chainId: number
  governanceChainId: number
  governanceEmitterAddress: string
  minimalConsistencyLevel: number
  messageFee: bigint
}

function loadSettings(network: 'devnet' | 'testnet' | 'mainnet'): Settings {
  const [alephiumConfig, guardianConfig] = network === 'devnet'
    ? [alephiumDevnetConfig, guardianDevnetConfig]
    : network === 'testnet'
    ? [alephiumTestnetConfig, guardianTestnetConfig]
    : [alephiumMainnetConfig, guardianMainnetConfig]
  return {
    initSigners: guardianConfig.initSigners as string[],
    chainId: alephiumConfig.chainId as number,
    governanceChainId: guardianConfig.governanceChainId as number,
    governanceEmitterAddress: guardianConfig.governanceEmitterAddress as string,
    minimalConsistencyLevel: alephiumConfig.minimalConsistencyLevel as number,
    messageFee: BigInt(alephiumConfig.messageFee)
  }
}

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
      networkId: 4,
      nodeUrl: 'http://localhost:22973',
      mnemonic:
        'vault alarm sad mass witness property virus style good flower rice alpha viable evidence run glare pretty scout evil judge enroll refuse another lava',
      confirmations: 1,
      settings: loadSettings('devnet')
    },

    testnet: {
      networkId: 1,
      nodeUrl: process.env.ALPH_NODE_URL as string,
      mnemonic: process.env.MNEMONIC as string,
      confirmations: 2,
      settings: loadSettings('testnet')
    },

    mainnet: {
      networkId: 0,
      nodeUrl: process.env.ALPH_NODE_URL as string,
      mnemonic: process.env.MNEMONIC as string,
      confirmations: 2,
      settings: loadSettings('mainnet')
    }
  }
}

export default configuration

import { Configuration } from './lib/deployment'
import * as dotenv from 'dotenv'

dotenv.config({ path: __dirname + '/.env' })

const settingsTemplate = {
  initSigners: JSON.parse(process.env.INIT_SIGNERS!) as string[],
  initChainId: parseInt(process.env.INIT_CHAIN_ID!),
  initGovChainId: parseInt(process.env.INIT_GOV_CHAIN_ID!),
  initGovContract: process.env.INIT_GOV_CONTRACT!,
  minimalConsistencyLevel: -1, // to be overwritten
  registerETHVAA: process.env.REGISTER_ETH_TOKEN_BRIDGE_VAA!,
  registerBSCVAA: process.env.REGISTER_BSC_TOKEN_BRIDGE_VAA!
}

export type Settings = typeof settingsTemplate

const configuration: Configuration<Settings> = {
  sourcePath: 'contracts',
  artifactPath: '../sdk/js/src/alephium/artifacts',

  deployScriptsPath: 'scripts',
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
      deploymentFile: '.deployments.json',
      confirmations: 1,
      settings: { ...settingsTemplate, minimalConsistencyLevel: 10 }
    },

    testnet: {
      networkId: 1,
      // TODO: update config
      nodeUrl: 'http://localhost:22973',
      mnemonic: process.env.MNEMONIC as string,
      deploymentFile: '.deployments.json',
      confirmations: 2,
      settings: { ...settingsTemplate, minimalConsistencyLevel: 10 }
    },

    mainnet: {
      networkId: 0,
      // TODO: update config
      nodeUrl: 'http://localhost:22973',
      mnemonic: process.env.MNEMONIC as string,
      deploymentFile: '.deployments.json',
      confirmations: 2,
      settings: { ...settingsTemplate, minimalConsistencyLevel: 105 }
    }
  }
}

export default configuration

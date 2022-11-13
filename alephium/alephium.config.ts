import { Configuration } from '@alephium/cli'
import * as dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.join(process.cwd(), '.env') })

const settingsTemplate = {
  initSigners: JSON.parse(process.env.INIT_SIGNERS!) as string[],
  initChainId: parseInt(process.env.INIT_CHAIN_ID!),
  initGovChainId: parseInt(process.env.INIT_GOV_CHAIN_ID!),
  initGovContract: process.env.INIT_GOV_CONTRACT!,
  minimalConsistencyLevel: -1, // to be overwritten
  registerETHVAA: process.env.REGISTER_ETH_TOKEN_BRIDGE_VAA!,
  registerBSCVAA: process.env.REGISTER_BSC_TOKEN_BRIDGE_VAA!,
  updateGuardianSetVAA: process.env.UPDATE_GUARDIAN_SET_VAA
}

export type Settings = typeof settingsTemplate

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
      settings: {
        ...settingsTemplate,
        minimalConsistencyLevel: process.env.MINIMAL_CONSISTENCY_LEVEL
          ? parseInt(process.env.MINIMAL_CONSISTENCY_LEVEL)
          : 10
      }
    },

    testnet: {
      networkId: 1,
      nodeUrl: 'https://alephium-testnet.softfork.se',
      mnemonic:
        'vault alarm sad mass witness property virus style good flower rice alpha viable evidence run glare pretty scout evil judge enroll refuse another lava',
      confirmations: 2,
      settings: { ...settingsTemplate, minimalConsistencyLevel: 10 }
    },

    mainnet: {
      networkId: 0,
      // TODO: update config
      nodeUrl: 'http://localhost:22973',
      mnemonic: process.env.MNEMONIC as string,
      confirmations: 2,
      settings: { ...settingsTemplate, minimalConsistencyLevel: 105 }
    }
  }
}

export default configuration

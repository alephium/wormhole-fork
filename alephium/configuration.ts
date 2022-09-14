import { Configuration } from './lib/deployment'

const configuration: Configuration = {
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
      confirmations: 1
    },

    testnet: {
      networkId: 1,
      // TODO: update config
      nodeUrl: 'http://localhost:22973',
      mnemonic: process.env.MNEMONIC as string,
      deploymentFile: '.deployments.json',
      confirmations: 2
    },

    mainnet: {
      networkId: 0,
      // TODO: update config
      nodeUrl: 'http://localhost:22973',
      mnemonic: process.env.MNEMONIC as string,
      deploymentFile: '.deployments.json',
      confirmations: 2
    }
  }
}

export default configuration

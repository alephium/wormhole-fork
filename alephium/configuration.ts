import { Configuration } from "./lib/deployment"

const configuration: Configuration = {
  sourcePath: "contracts",
  artifactPath: "../sdk/js/src/alephium/artifacts",

  deployScriptsPath: "scripts",
  compilerOptions: {
    errorOnWarnings: true,
    ignoreUnusedConstantsWarnings: true
  },

  defaultNetwork: "devnet",
  networks: {
    "devnet": {
      nodeUrl: "http://localhost:22973",
      mnemonic: "vault alarm sad mass witness property virus style good flower rice alpha viable evidence run glare pretty scout evil judge enroll refuse another lava",
      deploymentFile: ".deployments.json",
      confirmations: 1,
    },

    "testnet": {
      // TODO: update config
      nodeUrl: "http://localhost:22973",
      mnemonic: process.env.MNEMONIC as string,
      deploymentFile: ".deployments.json",
      confirmations: 10,
    },

    "mainnet": {
      // TODO: update config
      nodeUrl: "http://localhost:22973",
      mnemonic: process.env.MNEMONIC as string,
      deploymentFile: ".deployments.json",
      confirmations: 10,
    },
  }
}

export default configuration

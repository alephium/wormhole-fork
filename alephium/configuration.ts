import { Configuration } from "./lib/deployment"

const configuration: Configuration = {
  sourcePath: "contracts",
  artifactPath: "artifacts",

  deployScriptsPath: "scripts",
  compilerOptions: {
    errorOnWarnings: true,
    ignoreUnusedConstantsWarnings: true
  },

  networks: {
    "devnet": {
      nodeUrl: "http://localhost:22973",
      mnemonic: "vault alarm sad mass witness property virus style good flower rice alpha viable evidence run glare pretty scout evil judge enroll refuse another lava",
      deploymentFile: ".deployments.json"
    },

    "testnet": {
      // TODO: update config
      nodeUrl: "http://localhost:22973",
      mnemonic: process.env.MNEMONIC as string,
      deploymentFile: ".deployments.json"
    },

    "mainnet": {
      // TODO: update config
      nodeUrl: "http://localhost:22973",
      mnemonic: process.env.MNEMONIC as string,
      deploymentFile: ".deployments.json"
    },
  }
}

export default configuration

import { Configuration } from "./lib/deployment"

const configuration: Configuration = {
  sourcePath: "contracts",
  artifactPath: "artifacts",

  networks: {
    "devnet": {
      nodeUrl: "http://localhost:22973",
      mnemonic: "vault alarm sad mass witness property virus style good flower rice alpha viable evidence run glare pretty scout evil judge enroll refuse another lava",
      deploymentFile: ".deployments.json",
      scripts: [
        "scripts/deploy_test_token.ts",
        "scripts/deploy_devnet_deployer.ts",
        "scripts/deploy_governance.ts",
        "scripts/deploy_wrapped_alph.ts",
        "scripts/deploy_token_bridge_factory.ts",
        "scripts/deploy_token_bridge.ts",
        "scripts/register_chain.ts",
        "scripts/get_test_token.ts",
        "scripts/create_test_token_pool.ts",
        "scripts/create_wrapped_alph_pool.ts"
      ]
    },

    "testnet": {
      // TODO: update config
      nodeUrl: "http://localhost:22973",
      mnemonic: "vault alarm sad mass witness property virus style good flower rice alpha viable evidence run glare pretty scout evil judge enroll refuse another lava",
      deploymentFile: ".deployments.json",
      scripts: [
        "scripts/deploy_test_token.ts",
        "scripts/deploy_governance.ts",
        "scripts/deploy_wrapped_alph.ts",
        "scripts/deploy_token_bridge_factory.ts",
        "scripts/deploy_token_bridge.ts",
        "scripts/register_chain.ts",
        "scripts/get_test_token.ts",
        "scripts/create_test_token_pool.ts",
        "scripts/create_wrapped_alph_pool.ts"
      ]
    },

    "mainnet": {
      // TODO: update config
      nodeUrl: "http://localhost:22973",
      mnemonic: process.env.MNEMONIC as string,
      deploymentFile: ".deployments.json",
      scripts: [
        "scripts/deploy_governance.ts",
        "scripts/deploy_wrapped_alph.ts",
        "scripts/deploy_token_bridge_factory.ts",
        "scripts/deploy_token_bridge.ts",
        "scripts/register_chain.ts",
        "scripts/create_wrapped_alph_pool.ts"
      ]
    },
  }
}

export default configuration

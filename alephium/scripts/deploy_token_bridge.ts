import { addressFromContractId, Project, subContractId } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"
import * as dotenv from "dotenv"

dotenv.config({ path: __dirname+'/../.env' })

interface NetworkConfigs {
    minimalConsistencyLevel: number
}

// TODO: update this once we release the SDK
const networkConfigs: Record<NetworkType, NetworkConfigs> = {
    "mainnet": {
        minimalConsistencyLevel: 105
    },
    "testnet": {
        minimalConsistencyLevel: 10
    },
    "devnet": {
        minimalConsistencyLevel: 10
    }
}

const deployTokenBridge = async (deployer: Deployer, networkType: NetworkType): Promise<void> => {
  const tokenBridge = Project.contract('token_bridge/token_bridge.ral')
  const initFields = {
    'governance': deployer.getEnvironment("Governance"),
    'localChainId': parseInt(process.env.INIT_CHAIN_ID!),
    'receivedSequence': 0,
    'sendSequence': 0,
    'wrappedAlphId': deployer.getEnvironment("WrappedAlph"),
    'tokenBridgeFactory': deployer.getEnvironment("TokenBridgeFactory"),
    'minimalConsistencyLevel': networkConfigs[networkType].minimalConsistencyLevel
  }

  // TODO: remove devnet deployer once the contracts finalized
  if (networkType === "devnet") {
    const devnetDeployerId = deployer.getEnvironment('DevnetDeployer')
    const script = Project.script('devnet/deploy_token_bridge.ral')
    await deployer.runScript(script, {
      initialFields: {
        'deployer': devnetDeployerId,
        'bytecode': tokenBridge.bytecode,
        ...initFields
      }
    })
    const contractId = subContractId(devnetDeployerId, "01")
    const contractAddress = addressFromContractId(contractId)
    deployer.setEnvironment('TokenBridge', contractId)
    console.log(`TokenBridge contract address: ${contractAddress}, contract id: ${contractId}`)
  } else {
    const result = await deployer.deployContract(tokenBridge, {
      initialFields: initFields
    })
    deployer.setEnvironment('TokenBridge', result.contractId)
    console.log(`TokenBridge contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
  }
}

export default deployTokenBridge

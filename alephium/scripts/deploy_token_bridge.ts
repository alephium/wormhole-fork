import { Project } from "@alephium/web3"
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
  const tokenBridgeFactory = deployer.getDeployContractResult("TokenBridgeFactory")
  const governanceId = deployer.getDeployContractResult("Governance").contractId
  const wrappedAlphId = deployer.getDeployContractResult("WrappedAlph").contractId
  const initialFields = {
    'governance': governanceId,
    'wrappedAlphId': wrappedAlphId,
    'localChainId': parseInt(process.env.INIT_CHAIN_ID!),
    'receivedSequence': 0,
    'sendSequence': 0,
    'tokenBridgeFactory': tokenBridgeFactory.contractId,
    'minimalConsistencyLevel': networkConfigs[networkType].minimalConsistencyLevel
  }

  const result = await deployer.deployContract(tokenBridge, {
    initialFields: initialFields
  })
  console.log(`TokenBridge contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
}

export default deployTokenBridge

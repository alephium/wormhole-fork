import { addressFromContractId, Project, subContractId } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"
import * as dotenv from "dotenv"
import { getDevnetGovernanceId, getDevnetWrappedAlphId } from "./devnet"

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
  const initFields = {
    'localChainId': parseInt(process.env.INIT_CHAIN_ID!),
    'receivedSequence': 0,
    'sendSequence': 0,
    'tokenBridgeFactory': tokenBridgeFactory.contractId,
    'minimalConsistencyLevel': networkConfigs[networkType].minimalConsistencyLevel
  }

  // TODO: remove devnet deployer once the contracts finalized
  if (networkType === "devnet") {
    const devnetDeployer = deployer.getDeployContractResult('DevnetDeployer')
    const governanceId = getDevnetGovernanceId(deployer)
    const wrappedAlphId = getDevnetWrappedAlphId(deployer)
    const script = Project.script('devnet/deploy_token_bridge.ral')
    await deployer.runScript(script, {
      initialFields: {
        'governance': governanceId,
        'wrappedAlphId': wrappedAlphId,
        'deployer': devnetDeployer.contractId,
        'bytecode': tokenBridge.bytecode,
        ...initFields
      }
    })
    const contractId = subContractId(devnetDeployer.contractId, "01")
    const contractAddress = addressFromContractId(contractId)
    console.log(`TokenBridge contract address: ${contractAddress}, contract id: ${contractId}`)
  } else {
    const governanceId = deployer.getDeployContractResult("Governance").contractId
    const wrappedAlphId = deployer.getDeployContractResult("WrappedAlph").contractId
    const result = await deployer.deployContract(tokenBridge, {
      initialFields: {
        'governance': governanceId,
        'wrappedAlphId': wrappedAlphId,
        ...initFields
      }
    })
    console.log(`TokenBridge contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
  }
}

export default deployTokenBridge

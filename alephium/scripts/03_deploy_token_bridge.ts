import { Project } from '@alephium/web3'
import { Configuration, Deployer, DeployFunction, Network, NetworkType } from '../lib/deployment'
import * as dotenv from 'dotenv'
import { Settings } from '../configuration'

dotenv.config({ path: __dirname + '/../.env' })

interface NetworkConfigs {
  minimalConsistencyLevel: number
}

const deployTokenBridge: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  const tokenBridge = Project.contract('TokenBridge')
  const tokenBridgeFactory = deployer.getDeployContractResult('TokenBridgeFactory')
  const governanceId = deployer.getDeployContractResult('Governance').contractId
  const wrappedAlphId = deployer.getDeployContractResult('WrappedAlph').contractId
  const initialFields = {
    governance: governanceId,
    wrappedAlphId: wrappedAlphId,
    localChainId: network.settings.initChainId,
    receivedSequence: 0,
    sendSequence: 0,
    tokenBridgeFactory: tokenBridgeFactory.contractId,
    minimalConsistencyLevel: network.settings.minimalConsistencyLevel,
    refundAddress: deployer.account.address
  }

  const result = await deployer.deployContract(tokenBridge, {
    initialFields: initialFields
  })
  console.log(`TokenBridge contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
}

export default deployTokenBridge

import { Project } from '@alephium/web3'
import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { Settings } from '../alephium.config'

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

import { Deployer, DeployFunction, Network } from '@alephium/cli'
import { Settings } from '../alephium.config'
import { TokenBridge } from '../artifacts/ts'

const deployTokenBridge: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  const tokenBridgeFactory = deployer.getDeployContractResult('TokenBridgeFactory')
  const governanceId = deployer.getDeployContractResult('Governance').contractInstance.contractId
  const initialFields = {
    governance: governanceId,
    localChainId: BigInt(network.settings.chainId),
    receivedSequence: 0n,
    sendSequence: 0n,
    tokenBridgeFactory: tokenBridgeFactory.contractInstance.contractId,
    minimalConsistencyLevel: BigInt(network.settings.minimalConsistencyLevel),
    refundAddress: deployer.account.address
  }

  const result = await deployer.deployContract(TokenBridge, { initialFields: initialFields })
  console.log(
    `TokenBridge contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`
  )
}

export default deployTokenBridge

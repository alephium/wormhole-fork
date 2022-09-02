import { Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"

const deployDevnetDeployer = async (deployer: Deployer, _: NetworkType): Promise<void> => {
  const devnetDeployer = Project.contract('devnet/devnet_deployer.ral')
  const result = await deployer.deployContract(devnetDeployer, {})
  deployer.setEnvironment('DevnetDeployer', result.contractId)
}

export default deployDevnetDeployer

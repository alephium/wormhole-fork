import { Project } from '@alephium/web3'
import { Configuration, Deployer, DeployFunction, Network } from '@alephium/cli'
import { Settings } from '../alephium.config'

const guardianSetUpgrade: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  if (network.settings.guardianSetUpgradeVAA !== undefined) {
    const script = Project.script('UpdateGuardianSet')
    const governanceContractId = deployer.getDeployContractResult('Governance').contractId
    const initialFields = {
      governance: governanceContractId,
      vaa: network.settings.guardianSetUpgradeVAA
    }
    await deployer.runScript(script, {
      initialFields: initialFields
    })
  }
}

guardianSetUpgrade.skip = async (config: Configuration) => config.defaultNetwork !== 'devnet'

export default guardianSetUpgrade

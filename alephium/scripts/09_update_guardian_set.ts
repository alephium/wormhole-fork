import { Project } from '@alephium/web3'
import { Configuration, Deployer, DeployFunction, Network } from '@alephium/cli/types'
import { Settings } from '../alephium.config'

const updateGuardianSet: DeployFunction<Settings> = async (
  deployer: Deployer,
  network: Network<Settings>
): Promise<void> => {
  if (network.settings.updateGuardianSetVAA !== undefined) {
    const script = Project.script('UpdateGuardianSet')
    const governanceContractId = deployer.getDeployContractResult('Governance').contractId
    const initialFields = {
      governance: governanceContractId,
      vaa: network.settings.updateGuardianSetVAA
    }
    await deployer.runScript(script, {
      initialFields: initialFields
    })
  }
}

updateGuardianSet.skip = async (config: Configuration) => config.defaultNetwork !== 'devnet'

export default updateGuardianSet

import { Project } from '@alephium/web3'
import { Deployer, DeployFunction } from '@alephium/cli'
import { Settings } from '../alephium.config'

const deployLocalAttestTokenHandler: DeployFunction<Settings> = async (deployer: Deployer): Promise<void> => {
  const script = Project.script('CreateLocalAttestTokenHandler')
  const tokenBridgeId = deployer.getDeployContractResult('TokenBridge').contractId
  const initialFields = {
    tokenBridge: tokenBridgeId,
    payer: deployer.account.address,
    alphAmount: 10n ** 18n
  }
  await deployer.runScript(script, {
    initialFields: initialFields
  })
}

export default deployLocalAttestTokenHandler

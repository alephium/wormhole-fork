import { Deployer, DeployFunction } from '@alephium/cli'
import { ONE_ALPH } from '@alephium/web3'
import { Settings } from '../alephium.config'
import { CreateLocalAttestTokenHandler } from '../artifacts/ts'

const deployLocalAttestTokenHandler: DeployFunction<Settings> = async (deployer: Deployer): Promise<void> => {
  const tokenBridgeId = deployer.getDeployContractResult('TokenBridge').contractInstance.contractId
  const initialFields = {
    tokenBridge: tokenBridgeId,
    payer: deployer.account.address,
    alphAmount: ONE_ALPH
  }
  await deployer.runScript(CreateLocalAttestTokenHandler, {
    initialFields: initialFields,
    attoAlphAmount: ONE_ALPH
  })
}

export default deployLocalAttestTokenHandler

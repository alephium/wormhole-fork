import { ALPH_TOKEN_ID, Project } from '@alephium/web3'
import { Deployer, DeployFunction } from '@alephium/cli'

const oneAlph = BigInt('1000000000000000000')

const createAlphTokenPool: DeployFunction = async (deployer: Deployer): Promise<void> => {
  const script = Project.script('CreateLocalTokenPool')
  const tokenBridgeId = deployer.getDeployContractResult('TokenBridge').contractId
  const initialFields = {
    tokenBridge: tokenBridgeId,
    localTokenId: ALPH_TOKEN_ID,
    payer: deployer.account.address,
    alphAmount: oneAlph
  }
  await deployer.runScript(script, {
    initialFields: initialFields
  })
}

export default createAlphTokenPool

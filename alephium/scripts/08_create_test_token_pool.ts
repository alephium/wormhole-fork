import { Project } from '@alephium/web3'
import { Configuration, Deployer, DeployFunction } from '@alephium/cli'

const oneAlph = BigInt('1000000000000000000')

const createTestTokenPool: DeployFunction = async (deployer: Deployer): Promise<void> => {
  const script = Project.script('CreateLocalTokenPool')
  const testToken = deployer.getDeployContractResult('TestToken')
  const tokenBridgeId = deployer.getDeployContractResult('TokenBridge').contractId
  const initialFields = {
    tokenBridge: tokenBridgeId,
    localTokenId: testToken.contractId,
    payer: deployer.account.address,
    alphAmount: oneAlph
  }
  await deployer.runScript(script, {
    initialFields: initialFields,
    tokens: [
      {
        id: testToken.contractId,
        amount: 1n
      }
    ]
  })
}

createTestTokenPool.skip = async (config: Configuration) => config.defaultNetwork !== 'devnet'
export default createTestTokenPool

import { Project } from '@alephium/web3'
import { Configuration, Deployer, DeployFunction } from '@alephium/cli'

const oneAlph = BigInt('1000000000000000000')

const getTestToken: DeployFunction = async (deployer: Deployer): Promise<void> => {
  const script = Project.script('GetToken')
  const token = deployer.getDeployContractResult('TestToken')
  const initialFields = {
    sender: deployer.account.address,
    amount: oneAlph * 10n,
    token: token.contractId
  }
  await deployer.runScript(script, {
    initialFields: initialFields
  })
}

getTestToken.skip = async (config: Configuration) => config.defaultNetwork !== 'devnet'
export default getTestToken

import { Configuration, Deployer, DeployFunction } from '@alephium/cli'
import { DUST_AMOUNT, ONE_ALPH } from '@alephium/web3'
import { GetToken } from '../artifacts/ts'

const getTestToken: DeployFunction = async (deployer: Deployer): Promise<void> => {
  const token = deployer.getDeployContractResult('TestToken')
  const initialFields = {
    sender: deployer.account.address,
    amount: ONE_ALPH,
    factor: 10n ** 8n,
    token: token.contractId
  }
  await deployer.runScript(GetToken.execute, GetToken.script, {
    initialFields: initialFields,
    attoAlphAmount: ONE_ALPH + DUST_AMOUNT
  })
}

getTestToken.skip = async (config: Configuration) => config.defaultNetwork !== 'devnet'
export default getTestToken

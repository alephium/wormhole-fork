import { Deployer, DeployFunction } from '@alephium/cli'
import { DUST_AMOUNT, ONE_ALPH, NetworkId } from '@alephium/web3'
import { GetToken } from '../artifacts/ts'

const getTestToken: DeployFunction = async (deployer: Deployer): Promise<void> => {
  const token = deployer.getDeployContractResult('TestToken')
  const initialFields = {
    sender: deployer.account.address,
    amount: ONE_ALPH,
    factor: 10n ** 8n,
    token: token.contractInstance.contractId
  }
  await deployer.runScript(GetToken, {
    initialFields: initialFields,
    attoAlphAmount: ONE_ALPH + DUST_AMOUNT
  })
}

getTestToken.skip = async (_, networkId: NetworkId) => networkId !== 'devnet'
export default getTestToken

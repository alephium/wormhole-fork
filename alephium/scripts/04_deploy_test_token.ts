import { Project } from '@alephium/web3'
import { Configuration, Deployer, DeployFunction } from '@alephium/cli'

const deployTestToken: DeployFunction = async (deployer: Deployer): Promise<void> => {
  const tokenSupply = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
  const token = Project.contract('TestToken')
  const result = await deployer.deployContract(token, {
    issueTokenAmount: tokenSupply
  })
  console.log(`TestToken contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
}

deployTestToken.skip = async (config: Configuration) => config.defaultNetwork !== 'devnet'

export default deployTestToken

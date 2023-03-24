import { Configuration, Deployer, DeployFunction } from '@alephium/cli'
import { TestToken } from '../artifacts/ts'

const deployTestToken: DeployFunction = async (deployer: Deployer): Promise<void> => {
  const tokenSupply = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
  const encodeString = (str: string): string => Buffer.from(str, 'utf8').toString('hex')
  const result = await deployer.deployContract(TestToken, {
    initialFields: {
      decimals: 18n,
      symbol: encodeString('TT'),
      name: encodeString('TestToken'),
      totalSupply: tokenSupply
    },
    issueTokenAmount: tokenSupply
  })
  console.log(`TestToken contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
}

deployTestToken.skip = async (config: Configuration) => config.defaultNetwork !== 'devnet'

export default deployTestToken

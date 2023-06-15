import { Deployer, DeployFunction } from '@alephium/cli'
import { NetworkId } from '@alephium/web3'
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
  console.log(
    `TestToken contract address: ${result.contractInstance.address}, contract id: ${result.contractInstance.contractId}`
  )
}

deployTestToken.skip = async (_, networkId: NetworkId) => networkId !== 'devnet'

export default deployTestToken

import { Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"

const deployTestToken = async (deployer: Deployer, _: NetworkType): Promise<void> => {
  const tokenSupply = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
  const token = Project.contract('tests/test_token.ral')
  const result = await deployer.deployContract(token, {
    issueTokenAmount: tokenSupply
  })
  deployer.setEnvironment("TestToken", result.contractId)
  console.log(`TestToken contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
}

export default deployTestToken

import { Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"

const deployTestToken = async (deployer: Deployer, networkType: NetworkType): Promise<void> => {
  if (networkType === 'devnet') {
    const tokenSupply = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
    const token = Project.contract('TestToken')
    const result = await deployer.deployContract(token, {
      issueTokenAmount: tokenSupply
    })
    console.log(`TestToken contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
  }
}

export default deployTestToken

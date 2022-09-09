import { Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"

const oneAlph = BigInt("1000000000000000000")

const getTestToken = async (deployer: Deployer, networkType: NetworkType): Promise<void> => {
  if (networkType === 'devnet') {
    const script = Project.script('tests/get_token.ral')
    const token = deployer.getDeployContractResult("TestToken")
    const initialFields = {
      sender: deployer.account.address,
      amount: oneAlph * 10n,
      token: token.contractId
    }
    await deployer.runScript(script, {
      initialFields: initialFields
    })
  }
}

export default getTestToken

import { Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"

const oneAlph = BigInt("1000000000000000000")

const getTestToken = async (deployer: Deployer, _: NetworkType): Promise<void> => {
  const script = Project.script('tests/get_token.ral')
  const initFields = {
    sender: deployer.account.address,
    amount: oneAlph * 10n,
    token: deployer.getEnvironment("TestToken")
  }
  await deployer.runScript(script, {
    initialFields: initFields
  })
}

export default getTestToken

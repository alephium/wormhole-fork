import { Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"

const oneAlph = BigInt("1000000000000000000")

const createTestTokenPool = async (deployer: Deployer, _: NetworkType): Promise<void> => {
  const script = Project.script('token_bridge_scripts/create_local_token_pool.ral')
  const testTokenId = deployer.getEnvironment("TestToken")
  const initFields = {
    'tokenBridge': deployer.getEnvironment("TokenBridge"),
    'localTokenId': testTokenId,
    'payer': deployer.account.address,
    'alphAmount': oneAlph
  }
  await deployer.runScript(script, {
    initialFields: initFields,
    tokens: [{
      id: testTokenId,
      amount: 1
    }]
  })
}

export default createTestTokenPool

import { Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"
import { getDevnetTokenBridgeId } from "./devnet"

const oneAlph = BigInt("1000000000000000000")

const createTestTokenPool = async (deployer: Deployer, networkType: NetworkType): Promise<void> => {
  const script = Project.script('token_bridge_scripts/create_local_token_pool.ral')
  const testToken = deployer.getDeployContractResult("TestToken")
  const tokenBridgeId = networkType === 'devnet'
    ? getDevnetTokenBridgeId(deployer)
    : deployer.getDeployContractResult("TokenBridge").contractId
  const initFields = {
    'tokenBridge': tokenBridgeId,
    'localTokenId': testToken.contractId,
    'payer': deployer.account.address,
    'alphAmount': oneAlph
  }
  await deployer.runScript(script, {
    initialFields: initFields,
    tokens: [{
      id: testToken.contractId,
      amount: 1
    }]
  })
}

export default createTestTokenPool

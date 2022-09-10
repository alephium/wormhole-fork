import { Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"

const oneAlph = BigInt("1000000000000000000")

const createTestTokenPool = async (deployer: Deployer, networkType: NetworkType): Promise<void> => {
  if (networkType === 'devnet') {
    const script = Project.script('CreateLocalTokenPool')
    const testToken = deployer.getDeployContractResult("TestToken")
    const tokenBridgeId = deployer.getDeployContractResult("TokenBridge").contractId
    const initialFields = {
      'tokenBridge': tokenBridgeId,
      'localTokenId': testToken.contractId,
      'payer': deployer.account.address,
      'alphAmount': oneAlph
    }
    await deployer.runScript(script, {
      initialFields: initialFields,
      tokens: [{
        id: testToken.contractId,
        amount: 1
      }]
    })
  }
}

export default createTestTokenPool

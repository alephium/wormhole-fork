import { Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"

const oneAlph = BigInt("1000000000000000000")

const createWrappedAlphPool = async (deployer: Deployer, _: NetworkType): Promise<void> => {
  const script = Project.script('token_bridge_scripts/create_wrapped_alph_pool.ral')
  const tokenBridgeId = deployer.getDeployContractResult("TokenBridge").contractId
  const wrappedAlphId = deployer.getDeployContractResult("WrappedAlph").contractId
  const initialFields = {
    'tokenBridge': tokenBridgeId,
    'wrappedAlphId': wrappedAlphId,
    'payer': deployer.account.address,
    'alphAmount': oneAlph
  }
  await deployer.runScript(script, {
    initialFields: initialFields
  })
}

export default createWrappedAlphPool

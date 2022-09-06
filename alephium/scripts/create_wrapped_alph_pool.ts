import { Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"
import { getDevnetTokenBridgeId, getDevnetWrappedAlphId } from "./devnet"

const oneAlph = BigInt("1000000000000000000")

const createWrappedAlphPool = async (deployer: Deployer, networkType: NetworkType): Promise<void> => {
  const script = Project.script('token_bridge_scripts/create_wrapped_alph_pool.ral')
  const tokenBridgeId = networkType === 'devnet'
    ? await getDevnetTokenBridgeId(deployer)
    : deployer.getDeployContractResult("TokenBridge").contractId
  const wrappedAlphId = networkType === 'devnet'
    ? await getDevnetWrappedAlphId(deployer)
    : deployer.getDeployContractResult("WrappedAlph").contractId
  const initFields = {
    'tokenBridge': tokenBridgeId,
    'wrappedAlphId': wrappedAlphId,
    'payer': deployer.account.address,
    'alphAmount': oneAlph
  }
  await deployer.runScript(script, {
    initialFields: initFields
  })
}

export default createWrappedAlphPool

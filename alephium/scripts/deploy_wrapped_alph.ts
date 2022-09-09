import { Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"

const deployWrappedAlph = async (deployer: Deployer, networkType: NetworkType): Promise<void> => {
  const wrappedAlph = Project.contract('token_bridge/wrapped_alph.ral')
  const wrappedAlphPoolCodeHash = Project.contract('token_bridge/wrapped_alph_pool.ral').codeHash
  const initialFields = {
    'wrappedAlphPoolCodeHash': wrappedAlphPoolCodeHash,
    'totalWrapped': 0
  }

  const MaxALPHAmount = BigInt("1000000000") * BigInt("1000000000000000000")
  const result = await deployer.deployContract(wrappedAlph, {
    initialFields: initialFields,
    issueTokenAmount: MaxALPHAmount
  })
  console.log(`WrappedAlph contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
}

export default deployWrappedAlph

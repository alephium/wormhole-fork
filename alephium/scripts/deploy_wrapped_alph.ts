import { addressFromContractId, Project, subContractId } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"

const deployWrappedAlph = async (deployer: Deployer, networkType: NetworkType): Promise<void> => {
  const wrappedAlph = Project.contract('token_bridge/wrapped_alph.ral')
  const wrappedAlphPoolCodeHash = Project.contract('token_bridge/wrapped_alph_pool.ral').codeHash
  const initFields = {
    'wrappedAlphPoolCodeHash': wrappedAlphPoolCodeHash,
    'totalWrapped': 0
  }

  // TODO: remove devnet deployer once the contracts finalized
  if (networkType === 'devnet') {
    const devnetDeployer = deployer.getDeployContractResult('DevnetDeployer')
    const script = Project.script('devnet/deploy_wrapped_alph.ral')
    await deployer.runScript(script, {
      initialFields: {
        'deployer': devnetDeployer.contractId,
        'bytecode': wrappedAlph.bytecode,
        ...initFields
      }
    })
    const contractId = subContractId(devnetDeployer.contractId, "02")
    const contractAddress = addressFromContractId(contractId)
    console.log(`WrappedAlph contract address: ${contractAddress}, contract id: ${contractId}`)
  } else {
    const MaxALPHAmount = BigInt("1000000000") * BigInt("1000000000000000000")
    const result = await deployer.deployContract(wrappedAlph, {
      initialFields: initFields,
      issueTokenAmount: MaxALPHAmount
    })
    console.log(`WrappedAlph contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
  }
}

export default deployWrappedAlph

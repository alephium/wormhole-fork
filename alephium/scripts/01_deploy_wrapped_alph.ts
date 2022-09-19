import { Project } from '@alephium/web3'
import { Deployer, DeployFunction } from '@alephium/cli/types'

const deployWrappedAlph: DeployFunction = async (deployer: Deployer): Promise<void> => {
  const wrappedAlph = Project.contract('WrappedAlph')
  const wrappedAlphPoolCodeHash = Project.contract('WrappedAlphPool').codeHash
  const initialFields = {
    wrappedAlphPoolCodeHash: wrappedAlphPoolCodeHash,
    totalWrapped: 0
  }

  const MaxALPHAmount = BigInt('1000000000') * BigInt('1000000000000000000')
  const result = await deployer.deployContract(wrappedAlph, {
    initialFields: initialFields,
    issueTokenAmount: MaxALPHAmount
  })
  console.log(`WrappedAlph contract address: ${result.contractAddress}, contract id: ${result.contractId}`)
}

export default deployWrappedAlph

import { Project } from '@alephium/web3'
import { Deployer, DeployFunction } from '@alephium/cli/types'

const oneAlph = BigInt('1000000000000000000')

const createWrappedAlphPool: DeployFunction = async (deployer: Deployer): Promise<void> => {
  const script = Project.script('CreateWrappedAlphPool')
  const tokenBridgeId = deployer.getDeployContractResult('TokenBridge').contractId
  const wrappedAlphId = deployer.getDeployContractResult('WrappedAlph').contractId
  const initialFields = {
    tokenBridge: tokenBridgeId,
    wrappedAlphId: wrappedAlphId,
    payer: deployer.account.address,
    alphAmount: oneAlph
  }
  await deployer.runScript(script, {
    initialFields: initialFields
  })
}

export default createWrappedAlphPool

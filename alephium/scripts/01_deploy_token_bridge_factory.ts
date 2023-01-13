import { Fields, Project } from '@alephium/web3'
import { Deployer, DeployFunction } from '@alephium/cli'

async function deployTemplateContract(deployer: Deployer, name: string, initialFields: Fields): Promise<string> {
  const contract = Project.contract(name)
  const result = await deployer.deployContract(contract, {
    initialFields: initialFields
  })
  return result.contractId
}

const deployTokenBridgeFactory: DeployFunction = async (deployer: Deployer): Promise<void> => {
  const localTokenPoolId = await deployTemplateContract(deployer, 'LocalTokenPool', {
    tokenBridgeId: '',
    tokenChainId: 0n,
    bridgeTokenId: '',
    totalBridged: 0n,
    decimals_: 0n
  })
  const remoteTokenPoolId = await deployTemplateContract(deployer, 'RemoteTokenPool', {
    tokenBridgeId: '',
    tokenChainId: 0n,
    bridgeTokenId: '',
    totalBridged: 0n,
    symbol_: '',
    name_: '',
    decimals_: 0n,
    sequence_: 0n
  })
  const tokenBridgeForChainId = await deployTemplateContract(deployer, 'TokenBridgeForChain', {
    governance: '',
    localChainId: 0n,
    localTokenBridgeId: '',
    remoteChainId: 0n,
    remoteTokenBridgeId: '',
    start: 0n,
    firstNext256: 0n,
    secondNext256: 0n,
    unexecutedSequenceTemplateId: '',
    sendSequence: 0n
  })
  const attestTokenHandlerId = await deployTemplateContract(deployer, 'AttestTokenHandler', {
    governance: '',
    localTokenBridge: '',
    chainId: 0n,
    tokenBridgeId: '',
    receivedSequence: 0n,
    isLocalHandler: false
  })
  const unexecutedSequenceId = await deployTemplateContract(deployer, 'UnexecutedSequence', {
    parentId: '',
    begin: 0n,
    sequences: 0n
  })
  const tokenBridgeFactory = Project.contract('TokenBridgeFactory')
  const initialFields = {
    localTokenPoolTemplateId: localTokenPoolId,
    remoteTokenPoolTemplateId: remoteTokenPoolId,
    tokenBridgeForChainTemplateId: tokenBridgeForChainId,
    attestTokenHandlerTemplateId: attestTokenHandlerId,
    unexecutedSequenceTemplateId: unexecutedSequenceId
  }
  await deployer.deployContract(tokenBridgeFactory, {
    initialFields: initialFields
  })
}

export default deployTokenBridgeFactory

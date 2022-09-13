import { addressFromContractId, Fields, Project } from '@alephium/web3'
import { Deployer, DeployFunction } from '../lib/deployment'

const Byte32Zero = '0'.repeat(64)
const DummyRefundAddress = addressFromContractId(Byte32Zero)

async function deployTemplateContract(deployer: Deployer, name: string, initialFields: Fields): Promise<string> {
  const contract = Project.contract(name)
  const result = await deployer.deployContract(contract, {
    initialFields: initialFields
  })
  return result.contractId
}

const deployTokenBridgeFactory: DeployFunction = async (deployer: Deployer): Promise<void> => {
  const wrappedAlphPoolId = await deployTemplateContract(deployer, 'WrappedAlphPool', {
    tokenBridgeId: '',
    tokenChainId: 0,
    bridgeTokenId: '',
    totalBridged: 0,
    decimals_: 0
  })
  const localTokenPoolId = await deployTemplateContract(deployer, 'LocalTokenPool', {
    tokenBridgeId: '',
    tokenChainId: 0,
    bridgeTokenId: '',
    totalBridged: 0,
    decimals_: 0
  })
  const remoteTokenPoolId = await deployTemplateContract(deployer, 'RemoteTokenPool', {
    tokenBridgeId: '',
    tokenChainId: 0,
    bridgeTokenId: '',
    totalBridged: 0,
    symbol_: '',
    name_: '',
    decimals_: 0,
    sequence_: 0
  })
  const tokenBridgeForChainId = await deployTemplateContract(deployer, 'TokenBridgeForChain', {
    governance: '',
    localChainId: 0,
    localTokenBridgeId: '',
    remoteChainId: 0,
    remoteTokenBridgeId: '',
    start: 0,
    firstNext256: 0,
    secondNext256: 0,
    unexecutedSequenceTemplateId: '',
    refundAddress: DummyRefundAddress,
    sendSequence: 0
  })
  const attestTokenHandlerId = await deployTemplateContract(deployer, 'AttestTokenHandler', {
    governance: '',
    localTokenBridge: '',
    remoteChainId: 0,
    remoteTokenBridgeId: '',
    receivedSequence: 0
  })
  const unexecutedSequenceId = await deployTemplateContract(deployer, 'UnexecutedSequence', {
    parentId: '',
    begin: 0,
    sequences: 0n,
    refundAddress: DummyRefundAddress
  })
  const tokenBridgeFactory = Project.contract('TokenBridgeFactory')
  const initialFields = {
    wrappedAlphPoolTemplateId: wrappedAlphPoolId,
    localTokenPoolTemplateId: localTokenPoolId,
    remoteTokenPoolTemplateId: remoteTokenPoolId,
    tokenBridgeForChainTemplateId: tokenBridgeForChainId,
    attestTokenHandlerTemplateId: attestTokenHandlerId,
    unexecutedSequenceTemplateId: unexecutedSequenceId,
    refundAddress: deployer.account.address
  }
  await deployer.deployContract(tokenBridgeFactory, {
    initialFields: initialFields
  })
}

export default deployTokenBridgeFactory

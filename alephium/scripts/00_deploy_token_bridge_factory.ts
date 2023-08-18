import { Fields, ContractFactory } from '@alephium/web3'
import { Deployer, DeployFunction } from '@alephium/cli'
import {
  AttestTokenHandler,
  LocalTokenPool,
  RemoteTokenPool,
  TokenBridgeFactory,
  TokenBridgeForChain,
  UnexecutedSequence
} from '../artifacts/ts'

async function deployTemplateContract<F extends Fields>(
  deployer: Deployer,
  factory: ContractFactory<any, F>,
  initialFields: Fields
): Promise<string> {
  const result = await deployer.deployContract(factory, { initialFields: initialFields })
  return result.contractInstance.contractId
}

const deployTokenBridgeFactory: DeployFunction = async (deployer: Deployer): Promise<void> => {
  const localTokenPoolId = await deployTemplateContract(deployer, LocalTokenPool, {
    tokenBridge: '',
    tokenChainId: 0n,
    bridgeTokenId: '',
    totalBridged: 0n,
    decimals_: 0n
  })
  const remoteTokenPoolId = await deployTemplateContract(deployer, RemoteTokenPool, {
    tokenBridge: '',
    tokenChainId: 0n,
    bridgeTokenId: '',
    totalBridged: 0n,
    symbol_: '',
    name_: '',
    decimals_: 0n,
    sequence_: 0n
  })
  const tokenBridgeForChainId = await deployTemplateContract(deployer, TokenBridgeForChain, {
    governance: '',
    localChainId: 0n,
    localTokenBridge: '',
    remoteChainId: 0n,
    remoteTokenBridgeId: '',
    start: 0n,
    firstNext256: 0n,
    secondNext256: 0n,
    unexecutedSequenceTemplateId: '',
    sendSequence: 0n
  })
  const attestTokenHandlerId = await deployTemplateContract(deployer, AttestTokenHandler, {
    governance: '',
    localTokenBridge: '',
    targetChainId: 0n,
    targetTokenBridgeId: '',
    receivedSequence: 0n,
    isLocalHandler: false
  })
  const unexecutedSequenceId = await deployTemplateContract(deployer, UnexecutedSequence, {
    parentId: '',
    begin: 0n,
    sequences: 0n
  })
  const initialFields = {
    localTokenPoolTemplateId: localTokenPoolId,
    remoteTokenPoolTemplateId: remoteTokenPoolId,
    tokenBridgeForChainTemplateId: tokenBridgeForChainId,
    attestTokenHandlerTemplateId: attestTokenHandlerId,
    unexecutedSequenceTemplateId: unexecutedSequenceId
  }
  await deployer.deployContract(TokenBridgeFactory, { initialFields: initialFields })
}

export default deployTokenBridgeFactory

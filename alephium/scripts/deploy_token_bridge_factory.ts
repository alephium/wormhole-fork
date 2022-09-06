import { addressFromContractId, Fields, Project } from "@alephium/web3"
import { Deployer, NetworkType } from "../lib/deployment"

const Byte32Zero = "0".repeat(64)
const DummyRefundAddress = addressFromContractId(Byte32Zero)

async function deployTemplateContract(deployer: Deployer, contractPath: string, initFields: Fields): Promise<string> {
  const contract = Project.contract(contractPath)
  const result = await deployer.deployContract(contract, {
    initialFields: initFields
  })
  return result.contractId
}

const deployTokenBridgeFactory = async (deployer: Deployer, networkType: NetworkType): Promise<void> => {
  const wrappedAlphPoolId = await deployTemplateContract(
    deployer, "token_bridge/wrapped_alph_pool.ral", {
      'tokenBridgeId': '',
      'tokenChainId': 0,
      'bridgeTokenId': '',
      'totalBridged': 0,
      'decimals_': 0
    })
  const localTokenPoolId = await deployTemplateContract(
    deployer, "token_bridge/local_token_pool.ral", {
      'tokenBridgeId': '',
      'tokenChainId': 0,
      'bridgeTokenId': '',
      'totalBridged': 0,
      'decimals_': 0
    })
  const remoteTokenPoolId = await deployTemplateContract(
    deployer, "token_bridge/remote_token_pool.ral", {
      'tokenBridgeId': '',
      'tokenChainId': 0,
      'bridgeTokenId': '',
      'totalBridged': 0,
      'symbol_': '',
      'name_': '',
      'decimals_': 0
    })
  const tokenBridgeForChainId = await deployTemplateContract(
    deployer, "token_bridge/token_bridge_for_chain.ral", {
      'governance': '',
      'localChainId': 0,
      'localTokenBridgeId': '',
      'remoteChainId': 0,
      'remoteTokenBridgeId': '',
      'start': 0,
      'firstNext256': 0,
      'secondNext256': 0,
      'unexecutedSequenceTemplateId': '',
      'refundAddress': DummyRefundAddress,
      'sendSequence': 0
    })
  const attestTokenHandlerId = await deployTemplateContract(
    deployer, "token_bridge/attest_token_handler.ral", {
      'governance': '',
      'localTokenBridge': '',
      'remoteChainId': 0,
      'remoteTokenBridgeId': '',
      'receivedSequence': 0
    })
  const unexecutedSequenceId = await deployTemplateContract(
    deployer, "sequence/unexecuted_sequence.ral", {
      'parentId': '',
      'begin': 0,
      'sequences': 0n,
      'refundAddress': DummyRefundAddress
    })
  const tokenBridgeFactory = Project.contract('token_bridge/token_bridge_factory.ral')
  const initFields = {
    'wrappedAlphPoolTemplateId': wrappedAlphPoolId,
    'localTokenPoolTemplateId': localTokenPoolId,
    'remoteTokenPoolTemplateId': remoteTokenPoolId,
    'tokenBridgeForChainTemplateId': tokenBridgeForChainId,
    'attestTokenHandlerTemplateId': attestTokenHandlerId,
    'unexecutedSequenceTemplateId': unexecutedSequenceId,
    'refundAddress': deployer.account.address
  }
  await deployer.deployContract(tokenBridgeFactory, {
    initialFields: initFields
  })
}

export default deployTokenBridgeFactory

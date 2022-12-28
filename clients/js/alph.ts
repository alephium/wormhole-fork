import { CONFIGS } from './configs'
import { impossible } from './utils'
import { web3, Script, SubmissionResult, subContractId } from '@alephium/web3'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  updateGuardianSetScript,
  upgradeGovernanceContractScript,
  createRemoteTokenPoolOnAlph,
  upgradeTokenBridgeContractScript,
  setMessageFeeScript,
  transferFeeScript,
  destroyUnexecutedSequencesScript,
  updateMinimalConsistencyLevelScript,
  updateRefundAddressScript,
  registerChain,
  GovernancePayload
} from 'alephium-wormhole-sdk'

export async function executeGovernanceAlph(
  payload: GovernancePayload,
  vaa: Buffer,
  networkType: 'MAINNET' | 'TESTNET' | 'DEVNET',
  nodeUrl?: string
) {
  const network = CONFIGS[networkType]['alephium']
  const rpc = nodeUrl ?? network.rpc
  if (rpc === undefined) {
    throw Error(`No ${networkType} rpc defined for alephium (see networks.ts)`)
  }
  if (!network.key) {
    throw Error(`No ${networkType} key defined for alephium (see networks.ts)`)
  }

  web3.setCurrentNodeProvider(rpc)
  const wallet = PrivateKeyWallet.FromMnemonicWithGroup(network.key, 0)

  const executeGovernanceScript = async (script: Script): Promise<SubmissionResult> => {
    return script.execute(wallet, {
      initialFields: {
        'governance': network.governanceAddress,
        'vaa': vaa.toString('hex')
      }
    })
  }

  const executeTokenBridgeScript = async (script: Script): Promise<SubmissionResult> => {
    return script.execute(wallet, {
      initialFields: {
        'tokenBridge': network.tokenBridgeAddress,
        'vaa': vaa.toString('hex')
      }
    })
  }

  switch (payload.module) {
    case 'Core':
      if (network.governanceAddress === undefined) {
        throw Error(`Unknown core contract on ${networkType} for alephium`)
      }
      switch (payload.type) {
        case 'GuardianSetUpgrade':
          console.log('Submitting new guardian set')
          console.log(`TxId: ${(await executeGovernanceScript(updateGuardianSetScript())).txId}`)
          break
        case 'UpdateMessageFee':
          console.log('Submitting update message fee')
          console.log(`TxId: ${(await executeGovernanceScript(setMessageFeeScript())).txId}`)
          break
        case 'TransferFee':
          console.log('Submitting transfer fee')
          console.log(`TxId: ${(await executeGovernanceScript(transferFeeScript())).txId}`)
          break
        case 'AlphContractUpgrade':
          console.log(`Upgrading core contract`)
          console.log(`TxId: ${(await executeGovernanceScript(upgradeGovernanceContractScript())).txId}`)
          break
        default:
          throw new Error(`Invalid governance payload type: ${payload.type}`)
      }
      break
    case 'TokenBridge':
      if (network.tokenBridgeAddress === undefined) {
        throw Error(`Unknown token bridge contract on ${networkType} for alephium`)
      }
      switch (payload.type) {
        case 'ContractUpgrade':
          console.log('Upgrading contract')
          console.log(`TxId: ${(await executeTokenBridgeScript(upgradeTokenBridgeContractScript())).txId}`)
          break
        case 'RegisterChain':
          console.log('Registering chain')
          const result = await registerChain(wallet, network.tokenBridgeAddress, vaa, BigInt(2e18))
          console.log(`TxId: ${result.txId}`)
          break
        case 'DestroyUnexecutedSequences':
          console.log('Submitting destroy unexecuted sequences')
          console.log(`TxId: ${(await executeTokenBridgeScript(destroyUnexecutedSequencesScript())).txId}`)
          break
        case 'UpdateMinimalConsistencyLevel':
          console.log('Submitting update minimal consistency level')
          console.log(`TxId: ${(await executeTokenBridgeScript(updateMinimalConsistencyLevelScript())).txId}`)
          break
        case 'UpdateRefundAddress':
          console.log('Submitting update refund address')
          console.log(`TxId: ${(await executeTokenBridgeScript(updateRefundAddressScript())).txId}`)
          break
        default:
          throw new Error(`Invalid governance payload type: ${payload.type}`)
      }
      break
    case 'NFTBridge':
      throw Error('NFTBridge is not supported')
    default:
      impossible(payload)
  }
}

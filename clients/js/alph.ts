import { CONFIGS, NetworkType } from './configs'
import { impossible } from './utils'
import { web3, binToHex, addressFromContractId, ExecuteScriptResult, SignerProvider, ExecuteScriptParams, HexString } from '@alephium/web3'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { registerChain, GovernancePayload, alephium_contracts, deserializeTransferFeeVAA } from 'alephium-wormhole-sdk'
import {
  DestroyUnexecutedSequenceContracts,
  SetMessageFee,
  UpdateGovernanceContract,
  UpdateGuardianSet,
  UpdateMinimalConsistencyLevel,
  UpdateRefundAddress,
  UpgradeTokenBridgeContract
} from 'alephium-wormhole-sdk/lib/cjs/alephium-contracts/ts'

function getSignerProvider(network: any, nodeUrl?: string) {
  const rpc = nodeUrl ?? network.rpc
  if (rpc === undefined) {
    throw Error(`No rpc defined for alephium (see configs.ts)`)
  }
  if (!network.key) {
    throw Error(`No key defined for alephium (see configs.ts)`)
  }
  web3.setCurrentNodeProvider(rpc)
  return PrivateKeyWallet.FromMnemonicWithGroup(network.key, network.groupIndex)
}

async function getMessageFee(governanceId: string): Promise<bigint> {
  const governanceAddress = addressFromContractId(governanceId)
  const governance = alephium_contracts.Governance.at(governanceAddress)
  const contractState = await governance.fetchState()
  return contractState.fields.messageFee
}

export async function executeGovernanceAlph(
  payload: GovernancePayload,
  vaa: Buffer,
  networkType: NetworkType,
  nodeUrl?: string
) {
  const network = CONFIGS[networkType]['alephium']
  const wallet = getSignerProvider(network, nodeUrl)
  const vaaHex = binToHex(vaa)

  const executeGovernanceScript = async (
    func: (signer: SignerProvider, params: ExecuteScriptParams<{ governance: HexString; vaa: HexString; }>) => Promise<ExecuteScriptResult>
  ): Promise<ExecuteScriptResult> => {
    return func(wallet, {
      initialFields: {
        'governance': network.governanceAddress,
        'vaa': vaa.toString('hex')
      }
    })
  }

  const executeTokenBridgeScript = async (
    func: (signer: SignerProvider, params: ExecuteScriptParams<{ tokenBridge: HexString; vaa: HexString; }>) => Promise<ExecuteScriptResult>
  ): Promise<ExecuteScriptResult> => {
    return func(wallet, {
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
          console.log(`TxId: ${(await executeGovernanceScript(UpdateGuardianSet.execute)).txId}`)
          break
        case 'UpdateMessageFee':
          console.log('Submitting update message fee')
          console.log(`TxId: ${(await executeGovernanceScript(SetMessageFee.execute)).txId}`)
          break
        case 'TransferFee':
          console.log('Submitting transfer fee')
          const alphAmount = deserializeTransferFeeVAA(vaa).body.payload.amount
          const result = await alephium_contracts.TransferFee.execute(wallet, {
            initialFields: {
              governance: network.governanceAddress,
              vaa: vaaHex
            },
            attoAlphAmount: alphAmount
          })
          console.log(`TxId: ${result.txId}`)
          break
        case 'AlphContractUpgrade':
          console.log(`Upgrading core contract`)
          console.log(`TxId: ${(await executeGovernanceScript(UpdateGovernanceContract.execute)).txId}`)
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
          console.log(`TxId: ${(await executeTokenBridgeScript(UpgradeTokenBridgeContract.execute)).txId}`)
          break
        case 'RegisterChain':
          console.log('Registering chain')
          const result = await registerChain(wallet, network.tokenBridgeAddress, vaa, BigInt(2e18))
          console.log(`TxId: ${result.txId}`)
          break
        case 'DestroyUnexecutedSequences':
          console.log('Submitting destroy unexecuted sequences')
          console.log(`TxId: ${(await executeTokenBridgeScript(DestroyUnexecutedSequenceContracts.execute)).txId}`)
          break
        case 'UpdateMinimalConsistencyLevel':
          console.log('Submitting update minimal consistency level')
          console.log(`TxId: ${(await executeTokenBridgeScript(UpdateMinimalConsistencyLevel.execute)).txId}`)
          break
        case 'UpdateRefundAddress':
          console.log('Submitting update refund address')
          console.log(`TxId: ${(await executeTokenBridgeScript(UpdateRefundAddress.execute)).txId}`)
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

import { NETWORKS } from './networks'
import { impossible, Payload } from './vaa'
import { web3, Script, SubmissionResult, subContractId } from '@alephium/web3'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  Contracts,
  CONTRACTS,
  updateGuardianSetScript,
  upgradeGovernanceContractScript,
  createRemoteTokenPoolOnAlph,
  upgradeTokenBridgeContractScript,
  setMessageFeeScript,
  transferFeeScript,
  destroyUnexecutedSequencesScript,
  updateMinimalConsistencyLevelScript,
  updateRefundAddressScript,
  registerChain
} from 'alephium-wormhole-sdk'
import { P } from './parser'
import { Parser } from 'binary-parser'

export async function execute_governance_alph(
  payload: Payload,
  vaa: Buffer,
  network: 'MAINNET' | 'TESTNET' | 'DEVNET'
) {
  const n = NETWORKS[network]['alephium']
  if (!n.rpc) {
    throw Error(`No ${network} rpc defined for alephium (see networks.ts)`)
  }
  if (!n.key) {
    throw Error(`No ${network} key defined for alephium (see networks.ts)`)
  }

  const contracts: Contracts = CONTRACTS[network]['alephium']
  web3.setCurrentNodeProvider(n.rpc)
  const wallet = PrivateKeyWallet.FromMnemonicWithGroup(n.key, 0)

  const executeGovernanceScript = async (script: Script): Promise<SubmissionResult> => {
    return script.execute(wallet, {
      initialFields: {
        'governance': contracts.core,
        'vaa': vaa.toString('hex')
      }
    })
  }

  const executeTokenBridgeScript = async (script: Script): Promise<SubmissionResult> => {
    return script.execute(wallet, {
      initialFields: {
        'tokenBridge': contracts.token_bridge,
        'vaa': vaa.toString('hex')
      }
    })
  }

  const executeTokenBridgeExtensions = async (payloadId: typeof PayloadIds[PayloadIdName]): Promise<SubmissionResult> => {
    switch (payloadId) {
      case PayloadIds.DestroyUnexecutedSequencesId:
        console.log('Submitting destroy unexecuted sequences')
        return executeTokenBridgeScript(destroyUnexecutedSequencesScript())
      case PayloadIds.UpdateMinimalConsistencyLevelId:
        console.log('Submitting update minimal consistency level')
        return executeTokenBridgeScript(updateMinimalConsistencyLevelScript())
      case PayloadIds.UpdateRefundAddressId:
        console.log('Submitting update refund address')
        return executeTokenBridgeScript(updateRefundAddressScript())
    }
  }

  switch (payload.module) {
    case 'Core':
      if (contracts.core === undefined) {
        throw Error(`Unknown core contract on ${network} for alephium`)
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
        case 'ContractUpgrade':
          console.log(`Upgrading core contract`)
          console.log(`TxId: ${(await executeGovernanceScript(upgradeGovernanceContractScript())).txId}`)
          break
        default:
          impossible(payload)
      }
      break
    case 'TokenBridge':
      if (contracts.token_bridge === undefined) {
        throw Error(`Unknown token bridge contract on ${network} for alephium`)
      }
      switch (payload.type) {
        case 'ContractUpgrade':
          console.log('Upgrading contract')
          console.log(`TxId: ${(await executeTokenBridgeScript(upgradeTokenBridgeContractScript())).txId}`)
          break
        case 'RegisterChain':
          console.log('Registering chain')
          const result = await registerChain(wallet, contracts.token_bridge, vaa, BigInt(2e18))
          console.log(`TxId: ${result.txId}`)
          break
        case 'Extension':
          console.log(`Action: ${payload.action}`)
          console.log(`TxId: ${(await executeTokenBridgeExtensions(payload.action.payloadId)).txId}`)
          break
        default:
          impossible(payload)

      }
      break
    case 'NFTBridge':
      throw Error('NFTBridge is not supported')
    default:
      impossible(payload)
  }
}

export const PayloadIds = {
  DestroyUnexecutedSequencesId: 240,
  UpdateMinimalConsistencyLevelId: 241,
  UpdateRefundAddressId: 242
} as const

type PayloadIdName = keyof typeof PayloadIds
type PayloadId<Name extends PayloadIdName> = typeof PayloadIds[Name]

export interface DestroyUnexecutedSequences {
  payloadId: PayloadId<'DestroyUnexecutedSequencesId'>
  emitterChain: number
  sequences: number[]
}

const destroyUnexecutedSequencesParser: P<DestroyUnexecutedSequences> = new P(
  new Parser()
    .endianess('big')
    .uint8('payloadId', {
      assert: PayloadIds.DestroyUnexecutedSequencesId
    })
    .uint16('emitterChain')
    .uint16('length')
    .array('sequences', {
      length: 'length',
      type: 'uint64be',
      formatter: (sequences: bigint[]) => sequences.map(s => Number(s))
    })
    .string("end", {
      greedy: true,
      assert: str => str === ""
    })
)

function serialiseDestroyUnexecutedSequences(action: DestroyUnexecutedSequences): string {
  const body = [
    encodeNumber(action.payloadId, 1),
    encodeNumber(action.emitterChain, 2),
    encodeNumber(action.sequences.length, 2),
    action.sequences.map(s => encodeNumber(s, 8)).join('')
  ]
  return body.join('')
}

export interface UpdateMinimalConsistencyLevel {
  payloadId: PayloadId<'UpdateMinimalConsistencyLevelId'>
  newConsistencyLevel: number
}

const updateMinimalConsistencyLevelParser: P<UpdateMinimalConsistencyLevel> = new P(
  new Parser()
    .endianess('big')
    .uint8('payloadId', {
      assert: PayloadIds.UpdateMinimalConsistencyLevelId
    })
    .uint8('newConsistencyLevel')
    .string("end", {
      greedy: true,
      assert: str => str === ""
    })
)

function serialiseUpdateMinimalConsistencyLevel(action: UpdateMinimalConsistencyLevel): string {
  return encodeNumber(action.payloadId, 1) + encodeNumber(action.newConsistencyLevel, 1)
}

export interface UpdateRefundAddress {
  payloadId: PayloadId<'UpdateRefundAddressId'>
  newRefundAddress: Uint8Array
}

const updateRefundAddressParser: P<UpdateRefundAddress> = new P(
  new Parser()
    .endianess('big')
    .uint8('payloadId', {
      assert: PayloadIds.UpdateRefundAddressId
    })
    .uint16('length')
    .array('newRefundAddress', {
      type: 'uint8',
      length: 'length',
      formatter: (arr) => Uint8Array.from(arr)
    })
    .string("end", {
      greedy: true,
      assert: str => str === ""
    })
)

function serialiseUpdateRefundAddress(action: UpdateRefundAddress): string {
  const body = [
    encodeNumber(action.payloadId, 1),
    encodeNumber(action.newRefundAddress.length, 2),
    Buffer.from(action.newRefundAddress).toString('hex')
  ]
  return body.join('')
}

export type AlphTokenBridgeExtensions = DestroyUnexecutedSequences | UpdateMinimalConsistencyLevel | UpdateRefundAddress

export const alphTokenBridgeExtensionsParser: P<AlphTokenBridgeExtensions> =
  destroyUnexecutedSequencesParser
    .or(updateMinimalConsistencyLevelParser)
    .or(updateRefundAddressParser)

export const serialiseAlphTokenBridgeExtensions = function(action: AlphTokenBridgeExtensions): string {
  switch (action.payloadId) {
    case PayloadIds.DestroyUnexecutedSequencesId:
      return serialiseDestroyUnexecutedSequences(action)
    case PayloadIds.UpdateMinimalConsistencyLevelId:
      return serialiseUpdateMinimalConsistencyLevel(action)
    case PayloadIds.UpdateRefundAddressId:
      return serialiseUpdateRefundAddress(action)
  }
}

function encodeNumber(n: number, bytesLength: number): string {
  return n.toString(16).padStart(bytesLength * 2, '0')
}

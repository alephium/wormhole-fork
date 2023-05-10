import { CONFIGS, Guardians, NetworkType } from './configs'
import { impossible } from './utils'
import { NodeHttpTransport } from '@improbable-eng/grpc-web-node-http-transport'
import { web3, binToHex, addressFromContractId, ExecuteScriptResult, SignerProvider, ExecuteScriptParams, HexString } from '@alephium/web3'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  registerChain,
  GovernancePayload,
  attestFromAlph,
  waitAlphTxConfirmed,
  getSignedVAAWithRetry,
  parseSequenceFromLogAlph,
  CHAIN_ID_UNSET,
  createLocalTokenPoolOnAlph,
  getAttestTokenHandlerId,
  CHAIN_ID_ALEPHIUM,
  alephium_contracts,
  deserializeTransferFeeVAA,
} from 'alephium-wormhole-sdk'
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
  const wallet = new PrivateKeyWallet({privateKey: network.key})
  if (wallet.group !== network.groupIndex) {
    throw Error(`Invalid key, expected group ${network.groupIndex}`)
  }
  return wallet
}

async function getMessageFee(governanceId: string): Promise<bigint> {
  const governanceAddress = addressFromContractId(governanceId)
  const governance = alephium_contracts.Governance.at(governanceAddress)
  const contractState = await governance.fetchState()
  return contractState.fields.messageFee
}

export async function createLocalTokenPool(
  localTokenId: string,
  decimals: number,
  symbol: string,
  name: string,
  networkType: NetworkType,
  guardianUrl?: string,
  nodeUrl?: string
) {
  const network = CONFIGS[networkType]['alephium']
  const wallet = getSignerProvider(network, nodeUrl)

  const attestTokenTxId = await attestToken(
    wallet,
    localTokenId,
    decimals,
    symbol,
    name,
    network.governanceAddress,
    network.tokenBridgeAddress
  )
  await _createLocalTokenPool(
    wallet,
    attestTokenTxId,
    localTokenId,
    network.tokenBridgeAddress,
    network.groupIndex,
    networkType,
    guardianUrl
  )
}

async function attestToken(
  wallet: PrivateKeyWallet,
  localTokenId: string,
  decimals: number,
  symbol: string,
  name: string,
  governanceId: string,
  tokenBridgeId: string
) {
  const messageFee = await getMessageFee(governanceId)
  const attestTokenResult = await attestFromAlph(
    wallet,
    tokenBridgeId,
    localTokenId,
    decimals,
    symbol,
    name,
    wallet.address,
    messageFee,
    1
  )
  console.log(`attest token tx id: ${attestTokenResult.txId}`)
  await waitAlphTxConfirmed(web3.getCurrentNodeProvider(), attestTokenResult.txId, 1)
  console.log('attest token tx confirmed')
  return attestTokenResult.txId
}

async function _createLocalTokenPool(
  wallet: PrivateKeyWallet,
  attestTokenTxId: string,
  localTokenId: string,
  tokenBridgeId: string,
  groupIndex: number,
  networkType: NetworkType,
  guardianUrl?: string
) {
  const events = await web3.getCurrentNodeProvider().events.getEventsTxIdTxid(attestTokenTxId, {group: groupIndex})
  if (events.events.length < 1) {
    throw new Error(`no attest token event for tx ${attestTokenTxId}`)
  }
  const sequence = parseSequenceFromLogAlph(events.events[0])
  console.log(`trying to get signed vaa from guardinan, sequence: ${sequence}`)
  const guardianConfig = Guardians[networkType]
  const guardianUrls = guardianUrl === undefined ? guardianConfig.guardianUrls : [guardianUrl]
  const signedVaa = await getSignedVAAWithRetry(
    guardianUrls,
    CHAIN_ID_ALEPHIUM,
    tokenBridgeId,
    CHAIN_ID_UNSET, // the target chain id is 0 for attest token vaa
    sequence,
    { transport: NodeHttpTransport() },
    10000, // timeout
    10     // retry times
  )
  console.log(`got signed vaa: ${binToHex(signedVaa.vaaBytes)}`)
  const attestTokenHandlerId = getAttestTokenHandlerId(tokenBridgeId, CHAIN_ID_ALEPHIUM, groupIndex)
  const createLocalTokenPoolResult = await createLocalTokenPoolOnAlph(
    wallet,
    attestTokenHandlerId,
    localTokenId,
    signedVaa.vaaBytes,
    wallet.address,
    10n ** 18n
  )
  console.log(`create local token tx id: ${createLocalTokenPoolResult.txId}`)
  await waitAlphTxConfirmed(web3.getCurrentNodeProvider(), createLocalTokenPoolResult.txId, 1)
  console.log(`create local token pool for token ${localTokenId} succeed`)
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

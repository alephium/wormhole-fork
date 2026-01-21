import { CONFIGS, Guardians, NetworkType } from './configs'
import { impossible } from './utils'
import { web3, binToHex, addressFromContractId, ExecuteScriptResult, ExecutableScript, ONE_ALPH, DUST_AMOUNT } from '@alephium/web3'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import { registerChain, GovernancePayload, alephium_contracts, deserializeTransferFeeVAA, ChainId, getTokenBridgeForChainId } from '@alephium/wormhole-sdk'
import {
  DestroyUnexecutedSequenceContracts,
  SetMessageFee,
  UpdateGovernanceContract,
  UpdateGuardianSet,
  UpdateMinimalConsistencyLevel,
  UpdateRefundAddress,
  UpgradeTokenBridgeContract,
  AddRewards,
  Deposit,
  BridgeRewardRouterV2
} from '@alephium/wormhole-sdk/lib/cjs/alephium-contracts/ts'

export async function deposit(
  remoteChainId: ChainId,
  alphAmount: bigint,
  networkType: NetworkType,
  nodeUrl?: string
) {
  const network = CONFIGS[networkType]['alephium']
  const signer = getSignerProvider(network, nodeUrl)
  const amount = alphAmount * ONE_ALPH
  const tokenBridgeForChainId = getTokenBridgeForChainId(network.tokenBridgeAddress, remoteChainId, network.groupIndex)
  const result = await Deposit.execute(signer, {
    initialFields: {
      payer: signer.address,
      amount: amount,
      tokenBridgeForChain: tokenBridgeForChainId
    },
    attoAlphAmount: amount + DUST_AMOUNT
  })
  console.log(`TxId: ${result.txId}`)
}

export async function topupRewards(
  alphAmount: bigint,
  networkType: NetworkType,
  nodeUrl?: string
) {
  const network = CONFIGS[networkType]['alephium']
  const signer = getSignerProvider(network, nodeUrl)
  const amount = alphAmount * ONE_ALPH
  const result = await AddRewards.execute(signer, {
    initialFields: {
      bridgeRewardRouter: network.bridgeRewardRouter,
      amount: amount
    },
    attoAlphAmount: amount + DUST_AMOUNT
  })
  console.log(`TxId: ${result.txId}`)
}

export async function updateRewardAmount(
  attoAlphAmount: bigint,
  networkType: NetworkType,
  nodeUrl?: string
) {
  if (attoAlphAmount < DUST_AMOUNT) {
    throw new Error(`The reward amount cannot be less than the dust amount`)
  }

  const network = CONFIGS[networkType]['alephium']
  const signer = getSignerProvider(network, nodeUrl)
  const rewardRouterV2Address = addressFromContractId(network.bridgeRewardRouter)
  const rewardRouterV2 = BridgeRewardRouterV2.at(rewardRouterV2Address)
  const result = await rewardRouterV2.transact.updateRewardAmount({
    signer,
    args: { newRewardAmount: attoAlphAmount }
  })
  console.log(`TxId: ${result.txId}`)
}

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

export async function executeGovernanceAlph(
  payload: GovernancePayload,
  vaa: Buffer,
  networkType: NetworkType,
  nodeUrl?: string
) {
  const network = CONFIGS[networkType]['alephium']
  const wallet = getSignerProvider(network, nodeUrl)
  const vaaHex = binToHex(vaa)

  const executeGovernanceScript = async (executableScript: ExecutableScript): Promise<ExecuteScriptResult> => {
    return executableScript.execute(wallet, {
      initialFields: {
        'governance': network.governanceAddress,
        'vaa': vaa.toString('hex')
      }
    })
  }

  const executeTokenBridgeScript = async (executableScript: ExecutableScript): Promise<ExecuteScriptResult> => {
    return executableScript.execute(wallet, {
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
          console.log(`TxId: ${(await executeGovernanceScript(UpdateGuardianSet)).txId}`)
          break
        case 'UpdateMessageFee':
          console.log('Submitting update message fee')
          console.log(`TxId: ${(await executeGovernanceScript(SetMessageFee)).txId}`)
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
          console.log(`TxId: ${(await executeGovernanceScript(UpdateGovernanceContract)).txId}`)
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
          console.log(`TxId: ${(await executeTokenBridgeScript(UpgradeTokenBridgeContract)).txId}`)
          break
        case 'RegisterChain':
          console.log('Registering chain')
          const result = await registerChain(wallet, network.tokenBridgeAddress, vaa, BigInt(2e18))
          console.log(`TxId: ${result.txId}`)
          break
        case 'DestroyUnexecutedSequences':
          console.log('Submitting destroy unexecuted sequences')
          console.log(`TxId: ${(await executeTokenBridgeScript(DestroyUnexecutedSequenceContracts)).txId}`)
          break
        case 'UpdateMinimalConsistencyLevel':
          console.log('Submitting update minimal consistency level')
          console.log(`TxId: ${(await executeTokenBridgeScript(UpdateMinimalConsistencyLevel)).txId}`)
          break
        case 'UpdateRefundAddress':
          console.log('Submitting update refund address')
          console.log(`TxId: ${(await executeTokenBridgeScript(UpdateRefundAddress)).txId}`)
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

export async function getNextGovernanceSequence(networkType: NetworkType, explorerApiUrl: string): Promise<number> {
  const guardianConfig = Guardians[networkType]
  const url = `${explorerApiUrl}/api/vaas/next-governance-sequence/${guardianConfig.governanceChainId}/${guardianConfig.governanceEmitterAddress}`
  const response = await fetch(url)
  const json = await response.json()
  return json['sequence'] as number
}

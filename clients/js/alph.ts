import { NETWORKS } from './networks'
import { impossible, Payload } from './vaa'
import { web3, Script, SubmissionResult, subContractId } from '@alephium/web3'
import { PrivateKeyWallet } from '@alephium/web3-wallet'
import {
  Contracts,
  CONTRACTS,
  updateGuardianSetScript,
  upgradeGovernanceContract,
  createRemoteTokenPoolOnAlph,
  upgradeTokenBridgeContractScript
} from 'alephium-wormhole-sdk'

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
    const bytecode = script.buildByteCodeToDeploy({
      'governance': contracts.core,
      'vaa': vaa.toString('hex')
    })
    return wallet.signAndSubmitExecuteScriptTx({
      signerAddress: wallet.account.address,
      bytecode: bytecode
    })
  }

  const executeTokenBridgeScript = async (script: Script): Promise<SubmissionResult> => {
    const bytecode = script.buildByteCodeToDeploy({
      'tokenBridge': contracts.token_bridge,
      'vaa': vaa.toString('hex')
    })
    return wallet.signAndSubmitExecuteScriptTx({
      signerAddress: wallet.account.address,
      bytecode: bytecode
    })
  }

  switch (payload.module) {
    case 'Core':
      if (contracts.core === undefined) {
        throw Error(`Unknown core contract on ${network} for alephium`)
      }
      switch (payload.type) {
        case 'GuardianSetUpgrade':
          console.log('Submitting new guardian set')
          console.log(`Hash: ${(await executeGovernanceScript(updateGuardianSetScript())).txId}`) 
          break
        case 'ContractUpgrade':
          console.log(`Upgrading core contract`)
          console.log(`Hash: ${(await executeGovernanceScript(upgradeGovernanceContract())).txId}`)
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
          console.log(`Hash: ${(await executeTokenBridgeScript(upgradeTokenBridgeContractScript())).txId}`)
          break
        case 'RegisterChain':
          console.log('Registering chain')
          const attestTokenHandlerId = subContractId(contracts.token_bridge, '00')
          const bytecode = createRemoteTokenPoolOnAlph(
            attestTokenHandlerId,
            vaa,
            wallet.account.address,
            BigInt(1e18)
          )
          const result = await wallet.signAndSubmitExecuteScriptTx({
            signerAddress: wallet.account.address,
            bytecode: bytecode
          })
          console.log(`Hash: ${result.txId}`)
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

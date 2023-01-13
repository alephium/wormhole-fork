import {
  addressFromContractId,
  ALPH_TOKEN_ID,
  binToHex,
  BuildScriptTxResult,
  ContractState,
  fromApiVal,
  node,
  NodeProvider,
  SignerProvider,
  subContractId
} from "@alephium/web3"
import {
  depositScript,
  destroyUnexecutedSequencesScript,
  remoteTokenPoolContract,
  updateRefundAddressScript,
  registerChainScript
} from "../alephium/token_bridge"
import { bytes32ToUtf8String, ChainId } from "../utils"

export async function registerChain(
  signerProvider: SignerProvider,
  tokenBridgeId: string,
  signedVAA: Uint8Array,
  alphAmount: bigint
): Promise<BuildScriptTxResult> {
  const script = registerChainScript()
  const address = await signerProvider.getSelectedAddress()
  return script.execute(signerProvider, {
    initialFields: {
      payer: address,
      tokenBridge: tokenBridgeId,
      vaa: Buffer.from(signedVAA).toString('hex'),
      alphAmount: alphAmount
    },
    attoAlphAmount: alphAmount
  })
}

export async function deposit(
  signerProvider: SignerProvider,
  tokenBridgeForChainId: string,
  amount: bigint
): Promise<BuildScriptTxResult> {
  const script = depositScript()
  const address = await signerProvider.getSelectedAddress()
  return script.execute(signerProvider, {
    initialFields: {
      tokenBridgeForChain: tokenBridgeForChainId,
      payer: address,
      amount: amount
    },
    attoAlphAmount: amount
  })
}

export async function destroyUnexecutedSequenceContracts(
  signerProvider: SignerProvider,
  tokenBridgeId: string,
  signedVAA: Uint8Array
): Promise<BuildScriptTxResult> {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = destroyUnexecutedSequencesScript()
  return script.execute(signerProvider, {
    initialFields: {
      tokenBridge: tokenBridgeId,
      vaa: vaaHex
    }
  })
}

export async function updateRefundAddress(
  signerProvider: SignerProvider,
  tokenBridgeId: string,
  signedVAA: Uint8Array
): Promise<BuildScriptTxResult> {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = updateRefundAddressScript()
  return script.execute(signerProvider, {
    initialFields: {
      tokenBridge: tokenBridgeId,
      vaa: vaaHex
    }
  })
}

export function zeroPad(value: string, byteLength: number): string {
  const expectedLength = 2 * byteLength
  if (value.length < expectedLength) {
      const prefix = Array(expectedLength - value.length).fill('0').join("")
      return prefix + value
  }
  return value
}

export function getAttestTokenHandlerId(
  tokenBridgeId: string,
  remoteChainId: number,
  groupIndex: number
): string {
  const pathHex = '00' + zeroPad(remoteChainId.toString(16), 2)
  return subContractId(tokenBridgeId, pathHex, groupIndex)
}

export function getTokenBridgeForChainId(
  tokenBridgeId: string,
  remoteChainId: number,
  groupIndex: number
): string {
  const pathHex = '01' + zeroPad(remoteChainId.toString(16), 2)
  return subContractId(tokenBridgeId, pathHex, groupIndex)
}

export function getTokenPoolId(
  tokenBridgeId: string,
  tokenChainId: number,
  tokenId: string,
  groupIndex: number
): string {
  if (tokenId.length !== 64) {
    throw new Error(`Invalid token id ${tokenId}, expect 32 bytes hex string`)
  }
  const pathHex = '02' + zeroPad(tokenChainId.toString(16), 2) + tokenId
  return subContractId(tokenBridgeId, pathHex, groupIndex)
}

export function getUnexecutedSequenceId(
  tokenBridgeForChainId: string,
  index: number,
  groupIndex: number
): string {
  const pathHex = zeroPad(index.toString(16), 8)
  return subContractId(tokenBridgeForChainId, pathHex, groupIndex)
}

export async function contractExists(contractId: string, provider: NodeProvider): Promise<boolean> {
  const address = addressFromContractId(contractId)
  return provider
      .addresses
      .getAddressesAddressGroup(address)
      .then(_ => true)
      .catch((e: any) => {
        if (e instanceof Error && e.message.indexOf("Group not found") !== -1) {
          return false
        }
        throw e
      })
}

export interface TokenInfo {
  tokenId: string
  symbol: string
  name: string
  decimals: number
}

export interface RemoteTokenInfo extends TokenInfo {
  tokenChainId: ChainId
}

function _getRemoteTokenInfo(contractState: ContractState): RemoteTokenInfo {
  const tokenId = contractState.fields['bridgeTokenId'] as string
  const tokenChainId = Number(contractState.fields['tokenChainId'] as bigint) as ChainId
  const symbolHex = contractState.fields['symbol_'] as string
  const nameHex = contractState.fields['name_'] as string
  const decimals = Number(contractState.fields['decimals_'] as bigint)
  return {
    tokenId: tokenId,
    tokenChainId: tokenChainId,
    symbol: bytes32ToUtf8String(Buffer.from(symbolHex, 'hex')),
    name: bytes32ToUtf8String(Buffer.from(nameHex, 'hex')),
    decimals: decimals
  }
}

export function getRemoteTokenInfoFromContractState(state: node.ContractState): RemoteTokenInfo {
  const contract = remoteTokenPoolContract()
  return _getRemoteTokenInfo(contract.fromApiContractState(state))
}

export async function getRemoteTokenInfo(address: string, groupIndex: number): Promise<RemoteTokenInfo> {
  const contract = remoteTokenPoolContract()
  const contractState = await contract.fetchState(address, groupIndex)
  return _getRemoteTokenInfo(contractState)
}

export function stringToByte32Hex(str: string): string {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(str)
  if (bytes.length > 32) {
    throw new Error('string exceed 32 bytes')
  }
  return binToHex(bytes).padStart(64, '0')
}

function isConfirmed(txStatus: node.TxStatus): txStatus is node.Confirmed {
  return txStatus.type === 'Confirmed'
}

export async function waitAlphTxConfirmed(
  provider: NodeProvider,
  txId: string,
  confirmations: number
): Promise<node.Confirmed> {
  const status = await provider.transactions.getTransactionsStatus({ txId: txId })
  if (isConfirmed(status) && status.chainConfirmations >= confirmations) {
    return status
  }
  await new Promise((r) => setTimeout(r, 1000))
  return waitAlphTxConfirmed(provider, txId, confirmations)
}

export const ALPHTokenInfo: TokenInfo = {
  tokenId: ALPH_TOKEN_ID,
  symbol: 'ALPH',
  name: 'ALPH',
  decimals: 18
}

// TODO: move this to tokens-meta repo
export async function getLocalTokenInfo(nodeProvider: NodeProvider, tokenId: string): Promise<TokenInfo> {
  if (tokenId === ALPH_TOKEN_ID) {
    return ALPHTokenInfo
  }

  const groupIndex = parseInt(tokenId.slice(-2), 16)
  const contractAddress = addressFromContractId(tokenId)
  const callData: node.CallContract = {
    group: groupIndex,
    address: contractAddress,
    methodIndex: 0
  }
  const getSymbolResult = await nodeProvider.contracts.postContractsCallContract(callData)
  const getNameResult = await nodeProvider.contracts.postContractsCallContract({ ...callData, methodIndex: 1 })
  const getDecimalsResult = await nodeProvider.contracts.postContractsCallContract({ ...callData, methodIndex: 2 })

  if (
    getSymbolResult.returns.length !== 1 ||
    getNameResult.returns.length !== 1 ||
    getDecimalsResult.returns.length !== 1
  ) {
    throw new Error(`Invalid token ${tokenId}`)
  }

  const symbolHex = fromApiVal(getSymbolResult.returns[0], 'ByteVec') as string
  const nameHex = fromApiVal(getNameResult.returns[0], 'ByteVec') as string
  const decimals = fromApiVal(getDecimalsResult.returns[0], 'U256') as bigint
  return {
    tokenId: tokenId,
    symbol: Buffer.from(symbolHex, 'hex').toString('utf8'),
    name: Buffer.from(nameHex, 'hex').toString('utf8'),
    decimals: Number(decimals)
  }
}

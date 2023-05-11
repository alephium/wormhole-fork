import {
  addressFromContractId,
  ALPH_TOKEN_ID,
  binToHex,
  ExecuteScriptResult,
  node,
  NodeProvider,
  ONE_ALPH,
  SignerProvider,
  subContractId
} from "@alephium/web3"
import { bytes32ToUtf8String, ChainId } from "../utils"
import { 
  RegisterChain,
  Deposit,
  DestroyUnexecutedSequenceContracts,
  UpdateRefundAddress
} from "../alephium-contracts/ts/scripts"
import { RemoteTokenPool, RemoteTokenPoolTypes } from "../alephium-contracts/ts/RemoteTokenPool"
import { ALPH as ALPHTokenInfo, TokenInfo } from "@alephium/token-list"

export async function registerChain(
  signerProvider: SignerProvider,
  tokenBridgeId: string,
  signedVAA: Uint8Array,
  alphAmount: bigint
): Promise<ExecuteScriptResult> {
  if (alphAmount < (BigInt(2) * ONE_ALPH)) {
    throw new Error('Register chain will create two contracts, please approve at least 2 ALPH')
  }
  const account = await signerProvider.getSelectedAccount()
  return RegisterChain.execute(signerProvider, {
    initialFields: {
      payer: account.address,
      tokenBridge: tokenBridgeId,
      vaa: binToHex(signedVAA),
      alphAmount: ONE_ALPH
    },
    attoAlphAmount: alphAmount
  })
}

export async function deposit(
  signerProvider: SignerProvider,
  tokenBridgeForChainId: string,
  amount: bigint
): Promise<ExecuteScriptResult> {
  const account = await signerProvider.getSelectedAccount()
  return Deposit.execute(signerProvider, {
    initialFields: {
      tokenBridgeForChain: tokenBridgeForChainId,
      payer: account.address,
      amount: amount
    },
    attoAlphAmount: amount
  })
}

export async function destroyUnexecutedSequenceContracts(
  signerProvider: SignerProvider,
  tokenBridgeId: string,
  signedVAA: Uint8Array
): Promise<ExecuteScriptResult> {
  return DestroyUnexecutedSequenceContracts.execute(signerProvider, {
    initialFields: {
      tokenBridge: tokenBridgeId,
      vaa: binToHex(signedVAA)
    }
  })
}

export async function updateRefundAddress(
  signerProvider: SignerProvider,
  tokenBridgeId: string,
  signedVAA: Uint8Array
): Promise<ExecuteScriptResult> {
  return UpdateRefundAddress.execute(signerProvider, {
    initialFields: {
      tokenBridge: tokenBridgeId,
      vaa: binToHex(signedVAA)
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

export interface RemoteTokenInfo extends TokenInfo {
  tokenChainId: ChainId
}

export function getRemoteTokenInfoFromContractState(state: node.ContractState): RemoteTokenInfo {
  const contractState = RemoteTokenPool.contract.fromApiContractState(state) as RemoteTokenPoolTypes.State
  const tokenId = contractState.fields.bridgeTokenId as string
  const tokenChainId = Number(contractState.fields.tokenChainId) as ChainId
  const symbolHex = contractState.fields.symbol_ as string
  const nameHex = contractState.fields.name_ as string
  const decimals = Number(contractState.fields['decimals_'] as bigint)
  return {
    id: tokenId,
    tokenChainId: tokenChainId,
    symbol: bytes32ToUtf8String(Buffer.from(symbolHex, 'hex')),
    name: bytes32ToUtf8String(Buffer.from(nameHex, 'hex')),
    decimals: decimals
  }
}

export async function getRemoteTokenInfo(address: string): Promise<RemoteTokenInfo> {
  const contractState = await RemoteTokenPool.at(address).fetchState()
  return {
    id: contractState.fields.bridgeTokenId,
    tokenChainId: Number(contractState.fields.tokenChainId) as ChainId,
    symbol: bytes32ToUtf8String(Buffer.from(contractState.fields.symbol_, 'hex')),
    name: bytes32ToUtf8String(Buffer.from(contractState.fields.name_, 'hex')),
    decimals: Number(contractState.fields.decimals_)
  }
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

export async function getLocalTokenInfo(nodeProvider: NodeProvider, tokenId: string): Promise<TokenInfo> {
  if (tokenId === ALPH_TOKEN_ID) {
    return ALPHTokenInfo
  }

  const tokenMetaData = await nodeProvider.fetchStdTokenMetaData(tokenId)
  return {
    id: tokenId,
    symbol: Buffer.from(tokenMetaData.symbol, 'hex').toString('utf8'),
    name: Buffer.from(tokenMetaData.name, 'hex').toString('utf8'),
    decimals: tokenMetaData.decimals
  }
}

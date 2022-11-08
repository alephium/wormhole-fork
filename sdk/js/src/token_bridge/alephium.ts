import { addressFromContractId, BuildScriptTxResult, NodeProvider, SignerProvider, subContractId } from "@alephium/web3"
import { depositScript, destroyUnexecutedSequencesScript, updateRefundAddressScript } from "../alephium/token_bridge"

export async function deposit(
  signerProvider: SignerProvider,
  tokenBridgeForChainId: string,
  amount: bigint
): Promise<BuildScriptTxResult> {
  const script = depositScript()
  const account = await signerProvider.getSelectedAccount()
  return script.execute(signerProvider, {
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
  remoteChainId: number
): string {
  const pathHex = '00' + zeroPad(remoteChainId.toString(16), 2)
  return subContractId(tokenBridgeId, pathHex)
}

export function getTokenBridgeForChainId(
  tokenBridgeId: string,
  remoteChainId: number
): string {
  const pathHex = '01' + zeroPad(remoteChainId.toString(16), 2)
  return subContractId(tokenBridgeId, pathHex)
}

export function getTokenPoolId(
  tokenBridgeId: string,
  tokenChainId: number,
  tokenId: string
): string {
  if (tokenId.length !== 64) {
    throw new Error(`Invalid token id ${tokenId}, expect 32 bytes hex string`)
  }
  const pathHex = '02' + zeroPad(tokenChainId.toString(16), 2) + tokenId
  return subContractId(tokenBridgeId, pathHex)
}

export function getUnexecutedSequenceId(
  tokenBridgeForChainId: string,
  index: number
): string {
  const pathHex = zeroPad(index.toString(16), 8)
  return subContractId(tokenBridgeForChainId, pathHex)
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

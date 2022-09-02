import { NodeProvider, subContractId } from "@alephium/web3"
import { destroyUnexecutedSequencesScript } from "../alephium/token_bridge"
import { toAlphContractAddress } from "../utils"

export function destroyUnexecutedSequenceContracts(
  tokenBridgeId: string,
  signedVAA: Uint8Array
): string {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = destroyUnexecutedSequencesScript()
  return script.buildByteCodeToDeploy({
    tokenBridge: tokenBridgeId,
    vaa: vaaHex
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
  const pathHex = '02' + zeroPad(tokenChainId.toString(16), 2) + tokenId
  return subContractId(tokenBridgeId, pathHex)
}

export async function contractExists(contractId: string, provider: NodeProvider): Promise<boolean> {
  const address = toAlphContractAddress(contractId)
  return provider
      .addresses
      .getAddressesAddressGroup(address)
      .then(_ => true)
      .catch((e: any) => {
        const detail = e.error.detail as string
        if (detail.startsWith("Group not found")) {
          return false
        }
        throw e
      })
}

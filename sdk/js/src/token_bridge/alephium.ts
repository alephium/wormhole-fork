import { subContractId } from "@alephium/web3"
import { destroyUndoneSequencesScript } from "../alephium/token_bridge"

export function destroyUndoneSequenceContracts(
  tokenBridgeId: string,
  signedVAA: Uint8Array
): string {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = destroyUndoneSequencesScript()
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

import { destroyUndoneSequencesScript } from "../alephium/token_bridge"

export function destroyUndoneSequenceContracts(
  tokenBridgeId: string,
  signedVAA: Uint8Array
): string {
  const vaaHex = Buffer.from(signedVAA).toString('hex')
  const script = destroyUndoneSequencesScript()
  return script.buildByteCodeToDeploy({
    tokenBridgeId: tokenBridgeId,
    vaa: vaaHex
  })
}
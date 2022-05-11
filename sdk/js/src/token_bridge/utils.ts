import { Script, BuildScriptTx, SubmissionResult, SingleAddressSigner } from 'alephium-web3'

export async function executeScript(
  signer: SingleAddressSigner,
  script: Script,
  params: BuildScriptTx
): Promise<SubmissionResult> {
  const scriptTx = await script.transactionForDeployment(signer, params)
  return signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
}
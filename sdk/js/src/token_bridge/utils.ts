import { Signer, Script, BuildScriptTx, SubmissionResult } from 'alephium-web3'

export async function executeScript(
  signer: Signer,
  script: Script,
  templateVariables?: any,
  params?: BuildScriptTx
): Promise<SubmissionResult> {
  const scriptTx = await script.transactionForDeployment(signer, templateVariables, params)
  return signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
}
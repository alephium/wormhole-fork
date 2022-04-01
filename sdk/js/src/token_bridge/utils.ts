import { Signer, Script, BuildScriptTx } from 'alephium-js'

export async function executeScript(signer: Signer, bytecode: string, params?: BuildScriptTx) {
  const script = new Script('', '', bytecode, '', [])
  const scriptTx = await script.transactionForDeployment(signer, params)
  return signer.submitTransaction(scriptTx.unsignedTx, scriptTx.txId)
}
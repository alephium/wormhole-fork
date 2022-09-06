import { Deployer } from "../lib/deployment";
import { getCreatedContractId } from "../lib/utils";

let devnetGovernanceId: string | undefined = undefined
let devnetTokenBridgeId: string | undefined = undefined
let devnetWrappedAlphId: string | undefined = undefined

// TODO: remove this once the contract finalized
async function getDevnetContractId(deployer: Deployer, typeId: string): Promise<string> {
  const result = deployer.getRunScriptResult(typeId)
  return getCreatedContractId(
    deployer.provider,
    result.blockHash,
    result.txId
  )
}

export async function getDevnetGovernanceId(deployer: Deployer): Promise<string> {
  if (devnetGovernanceId === undefined) {
    devnetGovernanceId = await getDevnetContractId(deployer, "DevnetDeployGovernance")
  }
  return devnetGovernanceId
}

export async function getDevnetTokenBridgeId(deployer: Deployer): Promise<string> {
  if (devnetTokenBridgeId === undefined) {
    devnetTokenBridgeId = await getDevnetContractId(deployer, "DevnetDeployTokenBridge")
  }
  return devnetTokenBridgeId
}

export async function getDevnetWrappedAlphId(deployer: Deployer): Promise<string> {
  if (devnetWrappedAlphId === undefined) {
    devnetWrappedAlphId = await getDevnetContractId(deployer, "DevnetDeployWrappedAlph")
  }
  return devnetWrappedAlphId
}

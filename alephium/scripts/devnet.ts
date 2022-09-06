import { subContractId } from "@alephium/web3";
import { Deployer } from "../lib/deployment";

// TODO: remove this once the contract finalized
export function getDevnetGovernanceId(deployer: Deployer): string {
  const devnetDeployerId = deployer.getDeployContractResult("DevnetDeployer").contractId
  return subContractId(devnetDeployerId, "00")
}

export function getDevnetTokenBridgeId(deployer: Deployer): string {
  const devnetDeployerId = deployer.getDeployContractResult("DevnetDeployer").contractId
  return subContractId(devnetDeployerId, "01")
}

export function getDevnetWrappedAlphId(deployer: Deployer): string {
  const devnetDeployerId = deployer.getDeployContractResult("DevnetDeployer").contractId
  return subContractId(devnetDeployerId, "02")
}

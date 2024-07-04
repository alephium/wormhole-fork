/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { RunScriptResult, DeployContractExecutionResult } from "@alephium/cli";
import { NetworkId } from "@alephium/web3";
import {
  LocalTokenPool,
  LocalTokenPoolInstance,
  RemoteTokenPool,
  RemoteTokenPoolInstance,
  TokenBridgeForChain,
  TokenBridgeForChainInstance,
  AttestTokenHandler,
  AttestTokenHandlerInstance,
  UnexecutedSequence,
  UnexecutedSequenceInstance,
  TokenBridgeFactory,
  TokenBridgeFactoryInstance,
  Governance,
  GovernanceInstance,
  TokenBridge,
  TokenBridgeInstance,
  BridgeRewardRouter,
  BridgeRewardRouterInstance,
  TestToken,
  TestTokenInstance,
} from ".";
import { default as mainnetDeployments } from "../.deployments.mainnet.json";
import { default as testnetDeployments } from "../.deployments.testnet.json";
import { default as devnetDeployments } from "../.deployments.devnet.json";

export type Deployments = {
  deployerAddress: string;
  contracts: {
    LocalTokenPool: DeployContractExecutionResult<LocalTokenPoolInstance>;
    RemoteTokenPool: DeployContractExecutionResult<RemoteTokenPoolInstance>;
    TokenBridgeForChain: DeployContractExecutionResult<TokenBridgeForChainInstance>;
    AttestTokenHandler: DeployContractExecutionResult<AttestTokenHandlerInstance>;
    UnexecutedSequence: DeployContractExecutionResult<UnexecutedSequenceInstance>;
    TokenBridgeFactory: DeployContractExecutionResult<TokenBridgeFactoryInstance>;
    Governance: DeployContractExecutionResult<GovernanceInstance>;
    TokenBridge: DeployContractExecutionResult<TokenBridgeInstance>;
    BridgeRewardRouter: DeployContractExecutionResult<BridgeRewardRouterInstance>;
    TestToken?: DeployContractExecutionResult<TestTokenInstance>;
  };
  scripts: {
    CreateLocalAttestTokenHandler: RunScriptResult;
    GetToken?: RunScriptResult;
  };
};

function toDeployments(json: any): Deployments {
  const contracts = {
    LocalTokenPool: {
      ...json.contracts["LocalTokenPool"],
      contractInstance: LocalTokenPool.at(
        json.contracts["LocalTokenPool"].contractInstance.address
      ),
    },
    RemoteTokenPool: {
      ...json.contracts["RemoteTokenPool"],
      contractInstance: RemoteTokenPool.at(
        json.contracts["RemoteTokenPool"].contractInstance.address
      ),
    },
    TokenBridgeForChain: {
      ...json.contracts["TokenBridgeForChain"],
      contractInstance: TokenBridgeForChain.at(
        json.contracts["TokenBridgeForChain"].contractInstance.address
      ),
    },
    AttestTokenHandler: {
      ...json.contracts["AttestTokenHandler"],
      contractInstance: AttestTokenHandler.at(
        json.contracts["AttestTokenHandler"].contractInstance.address
      ),
    },
    UnexecutedSequence: {
      ...json.contracts["UnexecutedSequence"],
      contractInstance: UnexecutedSequence.at(
        json.contracts["UnexecutedSequence"].contractInstance.address
      ),
    },
    TokenBridgeFactory: {
      ...json.contracts["TokenBridgeFactory"],
      contractInstance: TokenBridgeFactory.at(
        json.contracts["TokenBridgeFactory"].contractInstance.address
      ),
    },
    Governance: {
      ...json.contracts["Governance"],
      contractInstance: Governance.at(
        json.contracts["Governance"].contractInstance.address
      ),
    },
    TokenBridge: {
      ...json.contracts["TokenBridge"],
      contractInstance: TokenBridge.at(
        json.contracts["TokenBridge"].contractInstance.address
      ),
    },
    BridgeRewardRouter: {
      ...json.contracts["BridgeRewardRouter"],
      contractInstance: BridgeRewardRouter.at(
        json.contracts["BridgeRewardRouter"].contractInstance.address
      ),
    },
    TestToken:
      json.contracts["TestToken"] === undefined
        ? undefined
        : {
            ...json.contracts["TestToken"],
            contractInstance: TestToken.at(
              json.contracts["TestToken"].contractInstance.address
            ),
          },
  };
  return {
    ...json,
    contracts: contracts as Deployments["contracts"],
    scripts: {
      CreateLocalAttestTokenHandler:
        json.scripts["CreateLocalAttestTokenHandler"],
      GetToken: json.scripts["GetToken"],
    },
  };
}

export function loadDeployments(
  networkId: NetworkId,
  deployerAddress?: string
): Deployments {
  const deployments =
    networkId === "mainnet"
      ? mainnetDeployments
      : networkId === "testnet"
      ? testnetDeployments
      : networkId === "devnet"
      ? devnetDeployments
      : undefined;
  if (deployments === undefined) {
    throw Error("The contract has not been deployed to the " + networkId);
  }
  const allDeployments: any[] = Array.isArray(deployments)
    ? deployments
    : [deployments];
  if (deployerAddress === undefined) {
    if (allDeployments.length > 1) {
      throw Error(
        "The contract has been deployed multiple times on " +
          networkId +
          ", please specify the deployer address"
      );
    } else {
      return toDeployments(allDeployments[0]);
    }
  }
  const result = allDeployments.find(
    (d) => d.deployerAddress === deployerAddress
  );
  if (result === undefined) {
    throw Error("The contract deployment result does not exist");
  }
  return toDeployments(result);
}

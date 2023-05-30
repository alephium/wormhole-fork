/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, ContractFactory } from "@alephium/web3";
import {
  Governance,
  UnexecutedSequence,
  Empty,
  GovernanceV1,
  MathTest,
  SequenceTest,
  TestToken,
  TokenBridgeV1,
  UnexecutedSequenceTest,
  AttestTokenHandler,
  LocalTokenPool,
  RemoteTokenPool,
  TokenBridge,
  TokenBridgeFactory,
  TokenBridgeForChain,
} from ".";

let contracts: ContractFactory<any>[] | undefined = undefined;
export function getContractByCodeHash(codeHash: string): Contract {
  if (contracts === undefined) {
    contracts = [
      Governance,
      UnexecutedSequence,
      Empty,
      GovernanceV1,
      MathTest,
      SequenceTest,
      TestToken,
      TokenBridgeV1,
      UnexecutedSequenceTest,
      AttestTokenHandler,
      LocalTokenPool,
      RemoteTokenPool,
      TokenBridge,
      TokenBridgeFactory,
      TokenBridgeForChain,
    ];
  }
  const c = contracts.find(
    (c) =>
      c.contract.codeHash === codeHash || c.contract.codeHashDebug === codeHash
  );
  if (c === undefined) {
    throw new Error("Unknown code with code hash: " + codeHash);
  }
  return c.contract;
}

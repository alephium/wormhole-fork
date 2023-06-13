/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  Address,
  Contract,
  ContractState,
  TestContractResult,
  HexString,
  ContractFactory,
  SubscribeOptions,
  EventSubscription,
  CallContractParams,
  CallContractResult,
  TestContractParams,
  ContractEvent,
  subscribeContractEvent,
  subscribeContractEvents,
  testMethod,
  callMethod,
  multicallMethods,
  fetchContractState,
  ContractInstance,
  getContractEventsCurrentCount,
} from "@alephium/web3";
import { default as GovernanceV1ContractJson } from "../tests/GovernanceV1.ral.json";
import { getContractByCodeHash } from "./contracts";

// Custom types for the contract
export namespace GovernanceV1Types {
  export type Fields = {
    chainId: bigint;
    governanceChainId: bigint;
    governanceEmitterAddress: HexString;
    tokenBridgeFactory: HexString;
    receivedSequence: bigint;
    messageFee: bigint;
    guardianSets: [HexString, HexString];
    guardianSetIndexes: [bigint, bigint];
    previousGuardianSetExpirationTimeMS: bigint;
  };

  export type State = ContractState<Fields>;
}

class Factory extends ContractFactory<
  GovernanceV1Instance,
  GovernanceV1Types.Fields
> {
  at(address: string): GovernanceV1Instance {
    return new GovernanceV1Instance(address);
  }

  tests = {
    foo: async (
      params: Omit<
        TestContractParams<GovernanceV1Types.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "foo", params);
    },
  };
}

// Use this object to test and deploy the contract
export const GovernanceV1 = new Factory(
  Contract.fromJson(
    GovernanceV1ContractJson,
    "",
    "237ca92e965dc50e86cb94535a4ffc9c9074ee6a7f1a1a24374f7380c6416d99"
  )
);

// Use this class to interact with the blockchain
export class GovernanceV1Instance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<GovernanceV1Types.State> {
    return fetchContractState(GovernanceV1, this);
  }
}
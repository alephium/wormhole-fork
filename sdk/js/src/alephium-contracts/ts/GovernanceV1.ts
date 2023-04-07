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
import { default as GovernanceV1ContractJson } from "../tests/governance_v1.ral.json";

// Custom types for the contract
export namespace GovernanceV1Types {
  export type Fields = {
    chainId: bigint;
    governanceChainId: bigint;
    governanceEmitterAddress: HexString;
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
    "351ea4360d2b31bf059c790536801450128a88d1ed1ce5c0d6c0f0eee8d313ac"
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
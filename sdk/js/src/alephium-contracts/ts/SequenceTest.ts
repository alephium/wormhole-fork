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
import { default as SequenceTestContractJson } from "../tests/sequence_test.ral.json";

// Custom types for the contract
export namespace SequenceTestTypes {
  export type Fields = {
    start: bigint;
    firstNext256: bigint;
    secondNext256: bigint;
    unexecutedSequenceTemplateId: HexString;
  };

  export type State = ContractState<Fields>;

  export interface CallMethodTable {
    check: {
      params: CallContractParams<{ seq: bigint }>;
      result: CallContractResult<boolean>;
    };
  }
  export type CallMethodParams<T extends keyof CallMethodTable> =
    CallMethodTable[T]["params"];
  export type CallMethodResult<T extends keyof CallMethodTable> =
    CallMethodTable[T]["result"];
  export type MultiCallParams = Partial<{
    [Name in keyof CallMethodTable]: CallMethodTable[Name]["params"];
  }>;
  export type MultiCallResults<T extends MultiCallParams> = {
    [MaybeName in keyof T]: MaybeName extends keyof CallMethodTable
      ? CallMethodTable[MaybeName]["result"]
      : undefined;
  };
}

class Factory extends ContractFactory<
  SequenceTestInstance,
  SequenceTestTypes.Fields
> {
  at(address: string): SequenceTestInstance {
    return new SequenceTestInstance(address);
  }

  tests = {
    setExecuted: async (
      params: TestContractParams<
        SequenceTestTypes.Fields,
        { offset: bigint; current: bigint }
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "setExecuted", params);
    },
    compact: async (
      params: Omit<
        TestContractParams<SequenceTestTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "compact", params);
    },
    checkSequenceInSubContract: async (
      params: TestContractParams<SequenceTestTypes.Fields, { seq: bigint }>
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "checkSequenceInSubContract", params);
    },
    checkSequence: async (
      params: TestContractParams<SequenceTestTypes.Fields, { seq: bigint }>
    ): Promise<TestContractResult<boolean>> => {
      return testMethod(this, "checkSequence", params);
    },
    check: async (
      params: TestContractParams<SequenceTestTypes.Fields, { seq: bigint }>
    ): Promise<TestContractResult<boolean>> => {
      return testMethod(this, "check", params);
    },
  };
}

// Use this object to test and deploy the contract
export const SequenceTest = new Factory(
  Contract.fromJson(
    SequenceTestContractJson,
    "",
    "8e793a256d2939004cd121580a652fa74f9083b6a51bc11936604f87a0ec5fe5"
  )
);

// Use this class to interact with the blockchain
export class SequenceTestInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<SequenceTestTypes.State> {
    return fetchContractState(SequenceTest, this);
  }

  methods = {
    check: async (
      params: SequenceTestTypes.CallMethodParams<"check">
    ): Promise<SequenceTestTypes.CallMethodResult<"check">> => {
      return callMethod(SequenceTest, this, "check", params);
    },
  };

  async multicall<Calls extends SequenceTestTypes.MultiCallParams>(
    calls: Calls
  ): Promise<SequenceTestTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      SequenceTest,
      this,
      calls
    )) as SequenceTestTypes.MultiCallResults<Calls>;
  }
}

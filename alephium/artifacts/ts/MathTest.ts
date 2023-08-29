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
  EventSubscribeOptions,
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
import { default as MathTestContractJson } from "../tests/MathTest.ral.json";
import { getContractByCodeHash } from "./contracts";

// Custom types for the contract
export namespace MathTestTypes {
  export type State = Omit<ContractState<any>, "fields">;

  export interface CallMethodTable {
    normalizeAmount: {
      params: CallContractParams<{ amount: bigint; decimals: bigint }>;
      result: CallContractResult<bigint>;
    };
    deNormalizeAmount: {
      params: CallContractParams<{ amount: bigint; decimals: bigint }>;
      result: CallContractResult<bigint>;
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

class Factory extends ContractFactory<MathTestInstance, {}> {
  at(address: string): MathTestInstance {
    return new MathTestInstance(address);
  }

  tests = {
    normalizeAmount: async (
      params: Omit<
        TestContractParams<never, { amount: bigint; decimals: bigint }>,
        "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "normalizeAmount", params);
    },
    deNormalizeAmount: async (
      params: Omit<
        TestContractParams<never, { amount: bigint; decimals: bigint }>,
        "initialFields"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "deNormalizeAmount", params);
    },
  };
}

// Use this object to test and deploy the contract
export const MathTest = new Factory(
  Contract.fromJson(
    MathTestContractJson,
    "",
    "69d44b2a740c60e15d881653e1f90da2c11e3d3bec68a30601beb64b072f343c"
  )
);

// Use this class to interact with the blockchain
export class MathTestInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<MathTestTypes.State> {
    return fetchContractState(MathTest, this);
  }

  methods = {
    normalizeAmount: async (
      params: MathTestTypes.CallMethodParams<"normalizeAmount">
    ): Promise<MathTestTypes.CallMethodResult<"normalizeAmount">> => {
      return callMethod(
        MathTest,
        this,
        "normalizeAmount",
        params,
        getContractByCodeHash
      );
    },
    deNormalizeAmount: async (
      params: MathTestTypes.CallMethodParams<"deNormalizeAmount">
    ): Promise<MathTestTypes.CallMethodResult<"deNormalizeAmount">> => {
      return callMethod(
        MathTest,
        this,
        "deNormalizeAmount",
        params,
        getContractByCodeHash
      );
    },
  };

  async multicall<Calls extends MathTestTypes.MultiCallParams>(
    calls: Calls
  ): Promise<MathTestTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      MathTest,
      this,
      calls,
      getContractByCodeHash
    )) as MathTestTypes.MultiCallResults<Calls>;
  }
}

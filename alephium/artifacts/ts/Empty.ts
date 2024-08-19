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
  TestContractParamsWithoutMaps,
  TestContractResultWithoutMaps,
  SignExecuteContractMethodParams,
  SignExecuteScriptTxResult,
  signExecuteMethod,
  addStdIdToFields,
  encodeContractFields,
} from "@alephium/web3";
import { default as EmptyContractJson } from "../tests/Empty.ral.json";
import { getContractByCodeHash } from "./contracts";

// Custom types for the contract
export namespace EmptyTypes {
  export type Fields = {
    a: bigint;
    b: bigint;
  };

  export type State = ContractState<Fields>;

  export interface CallMethodTable {
    foo: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<null>;
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
  export type MulticallReturnType<Callss extends MultiCallParams[]> =
    Callss["length"] extends 1
      ? MultiCallResults<Callss[0]>
      : { [index in keyof Callss]: MultiCallResults<Callss[index]> };

  export interface SignExecuteMethodTable {
    foo: {
      params: Omit<SignExecuteContractMethodParams<{}>, "args">;
      result: SignExecuteScriptTxResult;
    };
  }
  export type SignExecuteMethodParams<T extends keyof SignExecuteMethodTable> =
    SignExecuteMethodTable[T]["params"];
  export type SignExecuteMethodResult<T extends keyof SignExecuteMethodTable> =
    SignExecuteMethodTable[T]["result"];
}

class Factory extends ContractFactory<EmptyInstance, EmptyTypes.Fields> {
  encodeFields(fields: EmptyTypes.Fields) {
    return encodeContractFields(
      addStdIdToFields(this.contract, fields),
      this.contract.fieldsSig,
      []
    );
  }

  at(address: string): EmptyInstance {
    return new EmptyInstance(address);
  }

  tests = {
    foo: async (
      params: Omit<
        TestContractParamsWithoutMaps<EmptyTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResultWithoutMaps<null>> => {
      return testMethod(this, "foo", params, getContractByCodeHash);
    },
  };
}

// Use this object to test and deploy the contract
export const Empty = new Factory(
  Contract.fromJson(
    EmptyContractJson,
    "",
    "6d6160ec29f40a382f2154aa04b223925d5004e9848b0ca6f74b2f5bc8762d22",
    []
  )
);

// Use this class to interact with the blockchain
export class EmptyInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<EmptyTypes.State> {
    return fetchContractState(Empty, this);
  }

  view = {
    foo: async (
      params?: EmptyTypes.CallMethodParams<"foo">
    ): Promise<EmptyTypes.CallMethodResult<"foo">> => {
      return callMethod(
        Empty,
        this,
        "foo",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
  };

  transact = {
    foo: async (
      params: EmptyTypes.SignExecuteMethodParams<"foo">
    ): Promise<EmptyTypes.SignExecuteMethodResult<"foo">> => {
      return signExecuteMethod(Empty, this, "foo", params);
    },
  };
}

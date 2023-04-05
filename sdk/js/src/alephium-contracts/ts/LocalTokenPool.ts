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
import { default as LocalTokenPoolContractJson } from "../token_bridge/local_token_pool.ral.json";

// Custom types for the contract
export namespace LocalTokenPoolTypes {
  export type Fields = {
    tokenBridgeId: HexString;
    tokenChainId: bigint;
    bridgeTokenId: HexString;
    totalBridged: bigint;
    decimals_: bigint;
  };

  export type State = ContractState<Fields>;

  export interface CallMethodTable {
    normalizeAmount: {
      params: CallContractParams<{ amount: bigint; decimals: bigint }>;
      result: CallContractResult<bigint>;
    };
    deNormalizeAmount: {
      params: CallContractParams<{ amount: bigint; decimals: bigint }>;
      result: CallContractResult<bigint>;
    };
    transfer: {
      params: CallContractParams<{
        fromAddress: HexString;
        toAddress: HexString;
        amount: bigint;
        arbiterFee: bigint;
        nonce: HexString;
      }>;
      result: CallContractResult<HexString>;
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
  LocalTokenPoolInstance,
  LocalTokenPoolTypes.Fields
> {
  at(address: string): LocalTokenPoolInstance {
    return new LocalTokenPoolInstance(address);
  }

  tests = {
    completeTransfer: async (
      params: TestContractParams<
        LocalTokenPoolTypes.Fields,
        {
          emitterChainId: bigint;
          amount: bigint;
          vaaTokenId: HexString;
          vaaTokenChainId: bigint;
          recipient: HexString;
          normalizedArbiterFee: bigint;
          caller: HexString;
        }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "completeTransfer", params);
    },
    prepareTransfer: async (
      params: TestContractParams<
        LocalTokenPoolTypes.Fields,
        {
          callerContractId: HexString;
          toAddress: HexString;
          amount: bigint;
          arbiterFee: bigint;
          nonce: HexString;
        }
      >
    ): Promise<TestContractResult<[HexString, bigint]>> => {
      return testMethod(this, "prepareTransfer", params);
    },
    prepareCompleteTransfer: async (
      params: TestContractParams<
        LocalTokenPoolTypes.Fields,
        {
          callerContractId: HexString;
          emitterChainId: bigint;
          amount: bigint;
          vaaTokenId: HexString;
          vaaTokenChainId: bigint;
          normalizedArbiterFee: bigint;
        }
      >
    ): Promise<TestContractResult<[bigint, bigint]>> => {
      return testMethod(this, "prepareCompleteTransfer", params);
    },
    normalizeAmount: async (
      params: TestContractParams<
        LocalTokenPoolTypes.Fields,
        { amount: bigint; decimals: bigint }
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "normalizeAmount", params);
    },
    deNormalizeAmount: async (
      params: TestContractParams<
        LocalTokenPoolTypes.Fields,
        { amount: bigint; decimals: bigint }
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "deNormalizeAmount", params);
    },
    transfer: async (
      params: TestContractParams<
        LocalTokenPoolTypes.Fields,
        {
          fromAddress: HexString;
          toAddress: HexString;
          amount: bigint;
          arbiterFee: bigint;
          nonce: HexString;
        }
      >
    ): Promise<TestContractResult<HexString>> => {
      return testMethod(this, "transfer", params);
    },
  };
}

// Use this object to test and deploy the contract
export const LocalTokenPool = new Factory(
  Contract.fromJson(
    LocalTokenPoolContractJson,
    "",
    "444de82e20bcede3089a91a26ae45c8d28e47b7d903c97c18c24e195b47df769"
  )
);

// Use this class to interact with the blockchain
export class LocalTokenPoolInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<LocalTokenPoolTypes.State> {
    return fetchContractState(LocalTokenPool, this);
  }

  methods = {
    normalizeAmount: async (
      params: LocalTokenPoolTypes.CallMethodParams<"normalizeAmount">
    ): Promise<LocalTokenPoolTypes.CallMethodResult<"normalizeAmount">> => {
      return callMethod(LocalTokenPool, this, "normalizeAmount", params);
    },
    deNormalizeAmount: async (
      params: LocalTokenPoolTypes.CallMethodParams<"deNormalizeAmount">
    ): Promise<LocalTokenPoolTypes.CallMethodResult<"deNormalizeAmount">> => {
      return callMethod(LocalTokenPool, this, "deNormalizeAmount", params);
    },
    transfer: async (
      params: LocalTokenPoolTypes.CallMethodParams<"transfer">
    ): Promise<LocalTokenPoolTypes.CallMethodResult<"transfer">> => {
      return callMethod(LocalTokenPool, this, "transfer", params);
    },
  };

  async multicall<Calls extends LocalTokenPoolTypes.MultiCallParams>(
    calls: Calls
  ): Promise<LocalTokenPoolTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      LocalTokenPool,
      this,
      calls
    )) as LocalTokenPoolTypes.MultiCallResults<Calls>;
  }
}

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
import { default as RemoteTokenPoolContractJson } from "../token_bridge/remote_token_pool.ral.json";

// Custom types for the contract
export namespace RemoteTokenPoolTypes {
  export type Fields = {
    tokenBridgeId: HexString;
    tokenChainId: bigint;
    bridgeTokenId: HexString;
    totalBridged: bigint;
    symbol_: HexString;
    name_: HexString;
    decimals_: bigint;
    sequence_: bigint;
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
    name: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<HexString>;
    };
    symbol: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<HexString>;
    };
    decimals: {
      params: Omit<CallContractParams<{}>, "args">;
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
  RemoteTokenPoolInstance,
  RemoteTokenPoolTypes.Fields
> {
  at(address: string): RemoteTokenPoolInstance {
    return new RemoteTokenPoolInstance(address);
  }

  async testCompleteTransferMethod(
    params: TestContractParams<
      RemoteTokenPoolTypes.Fields,
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
  ): Promise<TestContractResult<null>> {
    return testMethod(this, "completeTransfer", params);
  }

  async testPrepareTransferMethod(
    params: TestContractParams<
      RemoteTokenPoolTypes.Fields,
      {
        callerContractId: HexString;
        toAddress: HexString;
        amount: bigint;
        arbiterFee: bigint;
        nonce: HexString;
      }
    >
  ): Promise<TestContractResult<[HexString, bigint]>> {
    return testMethod(this, "prepareTransfer", params);
  }

  async testPrepareCompleteTransferMethod(
    params: TestContractParams<
      RemoteTokenPoolTypes.Fields,
      {
        callerContractId: HexString;
        emitterChainId: bigint;
        amount: bigint;
        vaaTokenId: HexString;
        vaaTokenChainId: bigint;
        normalizedArbiterFee: bigint;
      }
    >
  ): Promise<TestContractResult<[bigint, bigint]>> {
    return testMethod(this, "prepareCompleteTransfer", params);
  }

  async testNormalizeAmountMethod(
    params: TestContractParams<
      RemoteTokenPoolTypes.Fields,
      { amount: bigint; decimals: bigint }
    >
  ): Promise<TestContractResult<bigint>> {
    return testMethod(this, "normalizeAmount", params);
  }

  async testDeNormalizeAmountMethod(
    params: TestContractParams<
      RemoteTokenPoolTypes.Fields,
      { amount: bigint; decimals: bigint }
    >
  ): Promise<TestContractResult<bigint>> {
    return testMethod(this, "deNormalizeAmount", params);
  }

  async testNameMethod(
    params: Omit<
      TestContractParams<RemoteTokenPoolTypes.Fields, never>,
      "testArgs"
    >
  ): Promise<TestContractResult<HexString>> {
    return testMethod(this, "name", params);
  }

  async testSymbolMethod(
    params: Omit<
      TestContractParams<RemoteTokenPoolTypes.Fields, never>,
      "testArgs"
    >
  ): Promise<TestContractResult<HexString>> {
    return testMethod(this, "symbol", params);
  }

  async testDecimalsMethod(
    params: Omit<
      TestContractParams<RemoteTokenPoolTypes.Fields, never>,
      "testArgs"
    >
  ): Promise<TestContractResult<bigint>> {
    return testMethod(this, "decimals", params);
  }

  async testUpdateDetailsMethod(
    params: TestContractParams<
      RemoteTokenPoolTypes.Fields,
      { symbol: HexString; name: HexString; sequence: bigint }
    >
  ): Promise<TestContractResult<null>> {
    return testMethod(this, "updateDetails", params);
  }

  async testTransferMethod(
    params: TestContractParams<
      RemoteTokenPoolTypes.Fields,
      {
        fromAddress: HexString;
        toAddress: HexString;
        amount: bigint;
        arbiterFee: bigint;
        nonce: HexString;
      }
    >
  ): Promise<TestContractResult<HexString>> {
    return testMethod(this, "transfer", params);
  }
}

// Use this object to test and deploy the contract
export const RemoteTokenPool = new Factory(
  Contract.fromJson(
    RemoteTokenPoolContractJson,
    "",
    "beed1be1ba36def0fd93c0a453398674b180f8f26e0c404f30b3443ab33fe902"
  )
);

// Use this class to interact with the blockchain
export class RemoteTokenPoolInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<RemoteTokenPoolTypes.State> {
    return fetchContractState(RemoteTokenPool, this);
  }

  async callNormalizeAmountMethod(
    params: RemoteTokenPoolTypes.CallMethodParams<"normalizeAmount">
  ): Promise<RemoteTokenPoolTypes.CallMethodResult<"normalizeAmount">> {
    return callMethod(RemoteTokenPool, this, "normalizeAmount", params);
  }

  async callDeNormalizeAmountMethod(
    params: RemoteTokenPoolTypes.CallMethodParams<"deNormalizeAmount">
  ): Promise<RemoteTokenPoolTypes.CallMethodResult<"deNormalizeAmount">> {
    return callMethod(RemoteTokenPool, this, "deNormalizeAmount", params);
  }

  async callNameMethod(
    params?: RemoteTokenPoolTypes.CallMethodParams<"name">
  ): Promise<RemoteTokenPoolTypes.CallMethodResult<"name">> {
    return callMethod(
      RemoteTokenPool,
      this,
      "name",
      params === undefined ? {} : params
    );
  }

  async callSymbolMethod(
    params?: RemoteTokenPoolTypes.CallMethodParams<"symbol">
  ): Promise<RemoteTokenPoolTypes.CallMethodResult<"symbol">> {
    return callMethod(
      RemoteTokenPool,
      this,
      "symbol",
      params === undefined ? {} : params
    );
  }

  async callDecimalsMethod(
    params?: RemoteTokenPoolTypes.CallMethodParams<"decimals">
  ): Promise<RemoteTokenPoolTypes.CallMethodResult<"decimals">> {
    return callMethod(
      RemoteTokenPool,
      this,
      "decimals",
      params === undefined ? {} : params
    );
  }

  async callTransferMethod(
    params: RemoteTokenPoolTypes.CallMethodParams<"transfer">
  ): Promise<RemoteTokenPoolTypes.CallMethodResult<"transfer">> {
    return callMethod(RemoteTokenPool, this, "transfer", params);
  }

  async multicall<Calls extends RemoteTokenPoolTypes.MultiCallParams>(
    calls: Calls
  ): Promise<RemoteTokenPoolTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      RemoteTokenPool,
      this,
      calls
    )) as RemoteTokenPoolTypes.MultiCallResults<Calls>;
  }
}

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
import { default as RemoteTokenPoolContractJson } from "../token_bridge/RemoteTokenPool.ral.json";
import { getContractByCodeHash } from "./contracts";

// Custom types for the contract
export namespace RemoteTokenPoolTypes {
  export type Fields = {
    tokenBridge: HexString;
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
    getSymbol: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<HexString>;
    };
    getName: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<HexString>;
    };
    getDecimals: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
    getTotalSupply: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<bigint>;
    };
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
        fromAddress: Address;
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
  consts = {
    AlphBridgePostfix: "2028416c706842726964676529",
    Path: {
      AttestTokenHandler: "00",
      TokenBridgeForChain: "01",
      TokenPool: "02",
    },
    ErrorCodes: {
      InvalidEmitChainId: BigInt(0),
      InvalidEmitAddress: BigInt(1),
      InvalidMessageSize: BigInt(2),
      InvalidSequence: BigInt(3),
      InvalidModule: BigInt(4),
      InvalidActionId: BigInt(5),
      InvalidVersion: BigInt(6),
      InvalidGuardianSetIndex: BigInt(7),
      InvalidGuardianSetSize: BigInt(8),
      InvalidSignatureSize: BigInt(9),
      InvalidSignatureGuardianIndex: BigInt(10),
      InvalidSignature: BigInt(11),
      GuardianSetExpired: BigInt(12),
      InvalidTargetChainId: BigInt(13),
      ContractStateMismatch: BigInt(14),
      InvalidRegisterChainMessage: BigInt(15),
      InvalidTokenId: BigInt(16),
      InvalidNonceSize: BigInt(17),
      TokenNotExist: BigInt(18),
      InvalidTransferTargetChain: BigInt(19),
      InvalidDestroyUnexecutedSequenceMessage: BigInt(20),
      InvalidCaller: BigInt(21),
      ArbiterFeeLessThanAmount: BigInt(22),
      InvalidAttestTokenMessage: BigInt(23),
      InvalidPayloadId: BigInt(24),
      InvalidTransferMessage: BigInt(25),
      ExpectRemoteToken: BigInt(26),
      InvalidConsistencyLevel: BigInt(27),
      InvalidUpdateRefundAddressMessage: BigInt(28),
      TransferAmountLessThanMessageFee: BigInt(29),
      InvalidAttestTokenArg: BigInt(30),
      InvalidAttestTokenHandler: BigInt(31),
      NotSupported: BigInt(32),
    },
    PayloadId: { Transfer: "01", AttestToken: "02" },
  };

  at(address: string): RemoteTokenPoolInstance {
    return new RemoteTokenPoolInstance(address);
  }

  tests = {
    getSymbol: async (
      params: Omit<
        TestContractParams<RemoteTokenPoolTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResult<HexString>> => {
      return testMethod(this, "getSymbol", params);
    },
    getName: async (
      params: Omit<
        TestContractParams<RemoteTokenPoolTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResult<HexString>> => {
      return testMethod(this, "getName", params);
    },
    getDecimals: async (
      params: Omit<
        TestContractParams<RemoteTokenPoolTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "getDecimals", params);
    },
    getTotalSupply: async (
      params: Omit<
        TestContractParams<RemoteTokenPoolTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "getTotalSupply", params);
    },
    completeTransfer: async (
      params: TestContractParams<
        RemoteTokenPoolTypes.Fields,
        {
          emitterChainId: bigint;
          amount: bigint;
          vaaTokenId: HexString;
          vaaTokenChainId: bigint;
          recipient: Address;
          normalizedArbiterFee: bigint;
          caller: Address;
        }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "completeTransfer", params);
    },
    prepareTransfer: async (
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
    ): Promise<TestContractResult<[HexString, bigint]>> => {
      return testMethod(this, "prepareTransfer", params);
    },
    prepareCompleteTransfer: async (
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
    ): Promise<TestContractResult<[bigint, bigint]>> => {
      return testMethod(this, "prepareCompleteTransfer", params);
    },
    normalizeAmount: async (
      params: TestContractParams<
        RemoteTokenPoolTypes.Fields,
        { amount: bigint; decimals: bigint }
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "normalizeAmount", params);
    },
    deNormalizeAmount: async (
      params: TestContractParams<
        RemoteTokenPoolTypes.Fields,
        { amount: bigint; decimals: bigint }
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "deNormalizeAmount", params);
    },
    updateDetails: async (
      params: TestContractParams<
        RemoteTokenPoolTypes.Fields,
        { symbol: HexString; name: HexString; sequence: bigint }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "updateDetails", params);
    },
    transfer: async (
      params: TestContractParams<
        RemoteTokenPoolTypes.Fields,
        {
          fromAddress: Address;
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
export const RemoteTokenPool = new Factory(
  Contract.fromJson(
    RemoteTokenPoolContractJson,
    "",
    "1887a5c2bc109b742c33e7c8aaa448d600e258cec66dbd7ff188b17fca3da2fd"
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

  methods = {
    getSymbol: async (
      params?: RemoteTokenPoolTypes.CallMethodParams<"getSymbol">
    ): Promise<RemoteTokenPoolTypes.CallMethodResult<"getSymbol">> => {
      return callMethod(
        RemoteTokenPool,
        this,
        "getSymbol",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getName: async (
      params?: RemoteTokenPoolTypes.CallMethodParams<"getName">
    ): Promise<RemoteTokenPoolTypes.CallMethodResult<"getName">> => {
      return callMethod(
        RemoteTokenPool,
        this,
        "getName",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getDecimals: async (
      params?: RemoteTokenPoolTypes.CallMethodParams<"getDecimals">
    ): Promise<RemoteTokenPoolTypes.CallMethodResult<"getDecimals">> => {
      return callMethod(
        RemoteTokenPool,
        this,
        "getDecimals",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getTotalSupply: async (
      params?: RemoteTokenPoolTypes.CallMethodParams<"getTotalSupply">
    ): Promise<RemoteTokenPoolTypes.CallMethodResult<"getTotalSupply">> => {
      return callMethod(
        RemoteTokenPool,
        this,
        "getTotalSupply",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    normalizeAmount: async (
      params: RemoteTokenPoolTypes.CallMethodParams<"normalizeAmount">
    ): Promise<RemoteTokenPoolTypes.CallMethodResult<"normalizeAmount">> => {
      return callMethod(
        RemoteTokenPool,
        this,
        "normalizeAmount",
        params,
        getContractByCodeHash
      );
    },
    deNormalizeAmount: async (
      params: RemoteTokenPoolTypes.CallMethodParams<"deNormalizeAmount">
    ): Promise<RemoteTokenPoolTypes.CallMethodResult<"deNormalizeAmount">> => {
      return callMethod(
        RemoteTokenPool,
        this,
        "deNormalizeAmount",
        params,
        getContractByCodeHash
      );
    },
    transfer: async (
      params: RemoteTokenPoolTypes.CallMethodParams<"transfer">
    ): Promise<RemoteTokenPoolTypes.CallMethodResult<"transfer">> => {
      return callMethod(
        RemoteTokenPool,
        this,
        "transfer",
        params,
        getContractByCodeHash
      );
    },
  };

  async multicall<Calls extends RemoteTokenPoolTypes.MultiCallParams>(
    calls: Calls
  ): Promise<RemoteTokenPoolTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      RemoteTokenPool,
      this,
      calls,
      getContractByCodeHash
    )) as RemoteTokenPoolTypes.MultiCallResults<Calls>;
  }
}

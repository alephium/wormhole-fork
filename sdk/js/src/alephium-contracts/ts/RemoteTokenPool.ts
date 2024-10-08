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
  Asset,
  ContractInstance,
  getContractEventsCurrentCount,
  TestContractParamsWithoutMaps,
  TestContractResultWithoutMaps,
  SignExecuteContractMethodParams,
  SignExecuteScriptTxResult,
  signExecuteMethod,
  addStdIdToFields,
  encodeContractFields,
  Narrow,
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
    completeTransfer: {
      params: CallContractParams<{
        emitterChainId: bigint;
        amount: bigint;
        vaaTokenId: HexString;
        vaaTokenChainId: bigint;
        recipient: Address;
        normalizedArbiterFee: bigint;
        caller: Address;
      }>;
      result: CallContractResult<null>;
    };
    prepareTransfer: {
      params: CallContractParams<{
        callerContractId: HexString;
        toAddress: HexString;
        amount: bigint;
        arbiterFee: bigint;
        nonce: HexString;
      }>;
      result: CallContractResult<[HexString, bigint]>;
    };
    prepareCompleteTransfer: {
      params: CallContractParams<{
        callerContractId: HexString;
        emitterChainId: bigint;
        amount: bigint;
        vaaTokenId: HexString;
        vaaTokenChainId: bigint;
        normalizedArbiterFee: bigint;
      }>;
      result: CallContractResult<[bigint, bigint]>;
    };
    normalizeAmount: {
      params: CallContractParams<{ amount: bigint; decimals: bigint }>;
      result: CallContractResult<bigint>;
    };
    deNormalizeAmount: {
      params: CallContractParams<{ amount: bigint; decimals: bigint }>;
      result: CallContractResult<bigint>;
    };
    updateDetails: {
      params: CallContractParams<{
        symbol: HexString;
        name: HexString;
        sequence: bigint;
      }>;
      result: CallContractResult<null>;
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
  export type MulticallReturnType<Callss extends MultiCallParams[]> = {
    [index in keyof Callss]: MultiCallResults<Callss[index]>;
  };

  export interface SignExecuteMethodTable {
    getSymbol: {
      params: Omit<SignExecuteContractMethodParams<{}>, "args">;
      result: SignExecuteScriptTxResult;
    };
    getName: {
      params: Omit<SignExecuteContractMethodParams<{}>, "args">;
      result: SignExecuteScriptTxResult;
    };
    getDecimals: {
      params: Omit<SignExecuteContractMethodParams<{}>, "args">;
      result: SignExecuteScriptTxResult;
    };
    getTotalSupply: {
      params: Omit<SignExecuteContractMethodParams<{}>, "args">;
      result: SignExecuteScriptTxResult;
    };
    completeTransfer: {
      params: SignExecuteContractMethodParams<{
        emitterChainId: bigint;
        amount: bigint;
        vaaTokenId: HexString;
        vaaTokenChainId: bigint;
        recipient: Address;
        normalizedArbiterFee: bigint;
        caller: Address;
      }>;
      result: SignExecuteScriptTxResult;
    };
    prepareTransfer: {
      params: SignExecuteContractMethodParams<{
        callerContractId: HexString;
        toAddress: HexString;
        amount: bigint;
        arbiterFee: bigint;
        nonce: HexString;
      }>;
      result: SignExecuteScriptTxResult;
    };
    prepareCompleteTransfer: {
      params: SignExecuteContractMethodParams<{
        callerContractId: HexString;
        emitterChainId: bigint;
        amount: bigint;
        vaaTokenId: HexString;
        vaaTokenChainId: bigint;
        normalizedArbiterFee: bigint;
      }>;
      result: SignExecuteScriptTxResult;
    };
    normalizeAmount: {
      params: SignExecuteContractMethodParams<{
        amount: bigint;
        decimals: bigint;
      }>;
      result: SignExecuteScriptTxResult;
    };
    deNormalizeAmount: {
      params: SignExecuteContractMethodParams<{
        amount: bigint;
        decimals: bigint;
      }>;
      result: SignExecuteScriptTxResult;
    };
    updateDetails: {
      params: SignExecuteContractMethodParams<{
        symbol: HexString;
        name: HexString;
        sequence: bigint;
      }>;
      result: SignExecuteScriptTxResult;
    };
    transfer: {
      params: SignExecuteContractMethodParams<{
        fromAddress: Address;
        toAddress: HexString;
        amount: bigint;
        arbiterFee: bigint;
        nonce: HexString;
      }>;
      result: SignExecuteScriptTxResult;
    };
  }
  export type SignExecuteMethodParams<T extends keyof SignExecuteMethodTable> =
    SignExecuteMethodTable[T]["params"];
  export type SignExecuteMethodResult<T extends keyof SignExecuteMethodTable> =
    SignExecuteMethodTable[T]["result"];
}

class Factory extends ContractFactory<
  RemoteTokenPoolInstance,
  RemoteTokenPoolTypes.Fields
> {
  encodeFields(fields: RemoteTokenPoolTypes.Fields) {
    return encodeContractFields(
      addStdIdToFields(this.contract, fields),
      this.contract.fieldsSig,
      []
    );
  }

  consts = {
    AlphBridgePostfix: "2028416c706842726964676529",
    Path: {
      AttestTokenHandler: "00",
      TokenBridgeForChain: "01",
      TokenPool: "02",
    },
    ErrorCodes: {
      InvalidEmitChainId: BigInt("0"),
      InvalidEmitAddress: BigInt("1"),
      InvalidMessageSize: BigInt("2"),
      InvalidSequence: BigInt("3"),
      InvalidModule: BigInt("4"),
      InvalidActionId: BigInt("5"),
      InvalidVersion: BigInt("6"),
      InvalidGuardianSetIndex: BigInt("7"),
      InvalidGuardianSetSize: BigInt("8"),
      InvalidSignatureSize: BigInt("9"),
      InvalidSignatureGuardianIndex: BigInt("10"),
      InvalidSignature: BigInt("11"),
      GuardianSetExpired: BigInt("12"),
      InvalidTargetChainId: BigInt("13"),
      ContractStateMismatch: BigInt("14"),
      InvalidRegisterChainMessage: BigInt("15"),
      InvalidTokenId: BigInt("16"),
      InvalidNonceSize: BigInt("17"),
      TokenNotExist: BigInt("18"),
      InvalidTransferTargetChain: BigInt("19"),
      InvalidDestroyUnexecutedSequenceMessage: BigInt("20"),
      InvalidCaller: BigInt("21"),
      ArbiterFeeLessThanAmount: BigInt("22"),
      InvalidAttestTokenMessage: BigInt("23"),
      InvalidPayloadId: BigInt("24"),
      InvalidTransferMessage: BigInt("25"),
      ExpectRemoteToken: BigInt("26"),
      InvalidConsistencyLevel: BigInt("27"),
      InvalidUpdateRefundAddressMessage: BigInt("28"),
      TransferAmountLessThanMessageFee: BigInt("29"),
      InvalidAttestTokenArg: BigInt("30"),
      InvalidAttestTokenHandler: BigInt("31"),
      NotSupported: BigInt("32"),
    },
    PayloadId: { Transfer: "01", AttestToken: "02" },
  };

  at(address: string): RemoteTokenPoolInstance {
    return new RemoteTokenPoolInstance(address);
  }

  tests = {
    getSymbol: async (
      params: Omit<
        TestContractParamsWithoutMaps<RemoteTokenPoolTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResultWithoutMaps<HexString>> => {
      return testMethod(this, "getSymbol", params, getContractByCodeHash);
    },
    getName: async (
      params: Omit<
        TestContractParamsWithoutMaps<RemoteTokenPoolTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResultWithoutMaps<HexString>> => {
      return testMethod(this, "getName", params, getContractByCodeHash);
    },
    getDecimals: async (
      params: Omit<
        TestContractParamsWithoutMaps<RemoteTokenPoolTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResultWithoutMaps<bigint>> => {
      return testMethod(this, "getDecimals", params, getContractByCodeHash);
    },
    getTotalSupply: async (
      params: Omit<
        TestContractParamsWithoutMaps<RemoteTokenPoolTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResultWithoutMaps<bigint>> => {
      return testMethod(this, "getTotalSupply", params, getContractByCodeHash);
    },
    completeTransfer: async (
      params: TestContractParamsWithoutMaps<
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
    ): Promise<TestContractResultWithoutMaps<null>> => {
      return testMethod(
        this,
        "completeTransfer",
        params,
        getContractByCodeHash
      );
    },
    prepareTransfer: async (
      params: TestContractParamsWithoutMaps<
        RemoteTokenPoolTypes.Fields,
        {
          callerContractId: HexString;
          toAddress: HexString;
          amount: bigint;
          arbiterFee: bigint;
          nonce: HexString;
        }
      >
    ): Promise<TestContractResultWithoutMaps<[HexString, bigint]>> => {
      return testMethod(this, "prepareTransfer", params, getContractByCodeHash);
    },
    prepareCompleteTransfer: async (
      params: TestContractParamsWithoutMaps<
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
    ): Promise<TestContractResultWithoutMaps<[bigint, bigint]>> => {
      return testMethod(
        this,
        "prepareCompleteTransfer",
        params,
        getContractByCodeHash
      );
    },
    normalizeAmount: async (
      params: TestContractParamsWithoutMaps<
        RemoteTokenPoolTypes.Fields,
        { amount: bigint; decimals: bigint }
      >
    ): Promise<TestContractResultWithoutMaps<bigint>> => {
      return testMethod(this, "normalizeAmount", params, getContractByCodeHash);
    },
    deNormalizeAmount: async (
      params: TestContractParamsWithoutMaps<
        RemoteTokenPoolTypes.Fields,
        { amount: bigint; decimals: bigint }
      >
    ): Promise<TestContractResultWithoutMaps<bigint>> => {
      return testMethod(
        this,
        "deNormalizeAmount",
        params,
        getContractByCodeHash
      );
    },
    updateDetails: async (
      params: TestContractParamsWithoutMaps<
        RemoteTokenPoolTypes.Fields,
        { symbol: HexString; name: HexString; sequence: bigint }
      >
    ): Promise<TestContractResultWithoutMaps<null>> => {
      return testMethod(this, "updateDetails", params, getContractByCodeHash);
    },
    transfer: async (
      params: TestContractParamsWithoutMaps<
        RemoteTokenPoolTypes.Fields,
        {
          fromAddress: Address;
          toAddress: HexString;
          amount: bigint;
          arbiterFee: bigint;
          nonce: HexString;
        }
      >
    ): Promise<TestContractResultWithoutMaps<HexString>> => {
      return testMethod(this, "transfer", params, getContractByCodeHash);
    },
  };

  stateForTest(
    initFields: RemoteTokenPoolTypes.Fields,
    asset?: Asset,
    address?: string
  ) {
    return this.stateForTest_(initFields, asset, address, undefined);
  }
}

// Use this object to test and deploy the contract
export const RemoteTokenPool = new Factory(
  Contract.fromJson(
    RemoteTokenPoolContractJson,
    "",
    "1887a5c2bc109b742c33e7c8aaa448d600e258cec66dbd7ff188b17fca3da2fd",
    []
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

  view = {
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
    completeTransfer: async (
      params: RemoteTokenPoolTypes.CallMethodParams<"completeTransfer">
    ): Promise<RemoteTokenPoolTypes.CallMethodResult<"completeTransfer">> => {
      return callMethod(
        RemoteTokenPool,
        this,
        "completeTransfer",
        params,
        getContractByCodeHash
      );
    },
    prepareTransfer: async (
      params: RemoteTokenPoolTypes.CallMethodParams<"prepareTransfer">
    ): Promise<RemoteTokenPoolTypes.CallMethodResult<"prepareTransfer">> => {
      return callMethod(
        RemoteTokenPool,
        this,
        "prepareTransfer",
        params,
        getContractByCodeHash
      );
    },
    prepareCompleteTransfer: async (
      params: RemoteTokenPoolTypes.CallMethodParams<"prepareCompleteTransfer">
    ): Promise<
      RemoteTokenPoolTypes.CallMethodResult<"prepareCompleteTransfer">
    > => {
      return callMethod(
        RemoteTokenPool,
        this,
        "prepareCompleteTransfer",
        params,
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
    updateDetails: async (
      params: RemoteTokenPoolTypes.CallMethodParams<"updateDetails">
    ): Promise<RemoteTokenPoolTypes.CallMethodResult<"updateDetails">> => {
      return callMethod(
        RemoteTokenPool,
        this,
        "updateDetails",
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

  transact = {
    getSymbol: async (
      params: RemoteTokenPoolTypes.SignExecuteMethodParams<"getSymbol">
    ): Promise<RemoteTokenPoolTypes.SignExecuteMethodResult<"getSymbol">> => {
      return signExecuteMethod(RemoteTokenPool, this, "getSymbol", params);
    },
    getName: async (
      params: RemoteTokenPoolTypes.SignExecuteMethodParams<"getName">
    ): Promise<RemoteTokenPoolTypes.SignExecuteMethodResult<"getName">> => {
      return signExecuteMethod(RemoteTokenPool, this, "getName", params);
    },
    getDecimals: async (
      params: RemoteTokenPoolTypes.SignExecuteMethodParams<"getDecimals">
    ): Promise<RemoteTokenPoolTypes.SignExecuteMethodResult<"getDecimals">> => {
      return signExecuteMethod(RemoteTokenPool, this, "getDecimals", params);
    },
    getTotalSupply: async (
      params: RemoteTokenPoolTypes.SignExecuteMethodParams<"getTotalSupply">
    ): Promise<
      RemoteTokenPoolTypes.SignExecuteMethodResult<"getTotalSupply">
    > => {
      return signExecuteMethod(RemoteTokenPool, this, "getTotalSupply", params);
    },
    completeTransfer: async (
      params: RemoteTokenPoolTypes.SignExecuteMethodParams<"completeTransfer">
    ): Promise<
      RemoteTokenPoolTypes.SignExecuteMethodResult<"completeTransfer">
    > => {
      return signExecuteMethod(
        RemoteTokenPool,
        this,
        "completeTransfer",
        params
      );
    },
    prepareTransfer: async (
      params: RemoteTokenPoolTypes.SignExecuteMethodParams<"prepareTransfer">
    ): Promise<
      RemoteTokenPoolTypes.SignExecuteMethodResult<"prepareTransfer">
    > => {
      return signExecuteMethod(
        RemoteTokenPool,
        this,
        "prepareTransfer",
        params
      );
    },
    prepareCompleteTransfer: async (
      params: RemoteTokenPoolTypes.SignExecuteMethodParams<"prepareCompleteTransfer">
    ): Promise<
      RemoteTokenPoolTypes.SignExecuteMethodResult<"prepareCompleteTransfer">
    > => {
      return signExecuteMethod(
        RemoteTokenPool,
        this,
        "prepareCompleteTransfer",
        params
      );
    },
    normalizeAmount: async (
      params: RemoteTokenPoolTypes.SignExecuteMethodParams<"normalizeAmount">
    ): Promise<
      RemoteTokenPoolTypes.SignExecuteMethodResult<"normalizeAmount">
    > => {
      return signExecuteMethod(
        RemoteTokenPool,
        this,
        "normalizeAmount",
        params
      );
    },
    deNormalizeAmount: async (
      params: RemoteTokenPoolTypes.SignExecuteMethodParams<"deNormalizeAmount">
    ): Promise<
      RemoteTokenPoolTypes.SignExecuteMethodResult<"deNormalizeAmount">
    > => {
      return signExecuteMethod(
        RemoteTokenPool,
        this,
        "deNormalizeAmount",
        params
      );
    },
    updateDetails: async (
      params: RemoteTokenPoolTypes.SignExecuteMethodParams<"updateDetails">
    ): Promise<
      RemoteTokenPoolTypes.SignExecuteMethodResult<"updateDetails">
    > => {
      return signExecuteMethod(RemoteTokenPool, this, "updateDetails", params);
    },
    transfer: async (
      params: RemoteTokenPoolTypes.SignExecuteMethodParams<"transfer">
    ): Promise<RemoteTokenPoolTypes.SignExecuteMethodResult<"transfer">> => {
      return signExecuteMethod(RemoteTokenPool, this, "transfer", params);
    },
  };

  async multicall<Calls extends RemoteTokenPoolTypes.MultiCallParams>(
    calls: Calls
  ): Promise<RemoteTokenPoolTypes.MultiCallResults<Calls>>;
  async multicall<Callss extends RemoteTokenPoolTypes.MultiCallParams[]>(
    callss: Narrow<Callss>
  ): Promise<RemoteTokenPoolTypes.MulticallReturnType<Callss>>;
  async multicall<
    Callss extends
      | RemoteTokenPoolTypes.MultiCallParams
      | RemoteTokenPoolTypes.MultiCallParams[]
  >(callss: Callss): Promise<unknown> {
    return await multicallMethods(
      RemoteTokenPool,
      this,
      callss,
      getContractByCodeHash
    );
  }
}

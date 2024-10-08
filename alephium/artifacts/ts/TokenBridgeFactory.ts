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
import { default as TokenBridgeFactoryContractJson } from "../token_bridge/TokenBridgeFactory.ral.json";
import { getContractByCodeHash } from "./contracts";

// Custom types for the contract
export namespace TokenBridgeFactoryTypes {
  export type Fields = {
    localTokenPoolTemplateId: HexString;
    remoteTokenPoolTemplateId: HexString;
    tokenBridgeForChainTemplateId: HexString;
    attestTokenHandlerTemplateId: HexString;
    unexecutedSequenceTemplateId: HexString;
  };

  export type State = ContractState<Fields>;

  export interface CallMethodTable {
    getLocalTokenPoolTemplateId: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<HexString>;
    };
    getRemoteTokenPoolTemplateId: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<HexString>;
    };
    getTokenBridgeForChainTemplateId: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<HexString>;
    };
    getAttestTokenHandlerTemplateId: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<HexString>;
    };
    getUnexecutedSequenceTemplateId: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<HexString>;
    };
    parseContractUpgrade: {
      params: CallContractParams<{ payload: HexString }>;
      result: CallContractResult<[HexString, HexString, HexString, HexString]>;
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
    getLocalTokenPoolTemplateId: {
      params: Omit<SignExecuteContractMethodParams<{}>, "args">;
      result: SignExecuteScriptTxResult;
    };
    getRemoteTokenPoolTemplateId: {
      params: Omit<SignExecuteContractMethodParams<{}>, "args">;
      result: SignExecuteScriptTxResult;
    };
    getTokenBridgeForChainTemplateId: {
      params: Omit<SignExecuteContractMethodParams<{}>, "args">;
      result: SignExecuteScriptTxResult;
    };
    getAttestTokenHandlerTemplateId: {
      params: Omit<SignExecuteContractMethodParams<{}>, "args">;
      result: SignExecuteScriptTxResult;
    };
    getUnexecutedSequenceTemplateId: {
      params: Omit<SignExecuteContractMethodParams<{}>, "args">;
      result: SignExecuteScriptTxResult;
    };
    parseContractUpgrade: {
      params: SignExecuteContractMethodParams<{ payload: HexString }>;
      result: SignExecuteScriptTxResult;
    };
  }
  export type SignExecuteMethodParams<T extends keyof SignExecuteMethodTable> =
    SignExecuteMethodTable[T]["params"];
  export type SignExecuteMethodResult<T extends keyof SignExecuteMethodTable> =
    SignExecuteMethodTable[T]["result"];
}

class Factory extends ContractFactory<
  TokenBridgeFactoryInstance,
  TokenBridgeFactoryTypes.Fields
> {
  encodeFields(fields: TokenBridgeFactoryTypes.Fields) {
    return encodeContractFields(
      addStdIdToFields(this.contract, fields),
      this.contract.fieldsSig,
      []
    );
  }

  consts = {
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
  };

  at(address: string): TokenBridgeFactoryInstance {
    return new TokenBridgeFactoryInstance(address);
  }

  tests = {
    getLocalTokenPoolTemplateId: async (
      params: Omit<
        TestContractParamsWithoutMaps<TokenBridgeFactoryTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResultWithoutMaps<HexString>> => {
      return testMethod(
        this,
        "getLocalTokenPoolTemplateId",
        params,
        getContractByCodeHash
      );
    },
    getRemoteTokenPoolTemplateId: async (
      params: Omit<
        TestContractParamsWithoutMaps<TokenBridgeFactoryTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResultWithoutMaps<HexString>> => {
      return testMethod(
        this,
        "getRemoteTokenPoolTemplateId",
        params,
        getContractByCodeHash
      );
    },
    getTokenBridgeForChainTemplateId: async (
      params: Omit<
        TestContractParamsWithoutMaps<TokenBridgeFactoryTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResultWithoutMaps<HexString>> => {
      return testMethod(
        this,
        "getTokenBridgeForChainTemplateId",
        params,
        getContractByCodeHash
      );
    },
    getAttestTokenHandlerTemplateId: async (
      params: Omit<
        TestContractParamsWithoutMaps<TokenBridgeFactoryTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResultWithoutMaps<HexString>> => {
      return testMethod(
        this,
        "getAttestTokenHandlerTemplateId",
        params,
        getContractByCodeHash
      );
    },
    getUnexecutedSequenceTemplateId: async (
      params: Omit<
        TestContractParamsWithoutMaps<TokenBridgeFactoryTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResultWithoutMaps<HexString>> => {
      return testMethod(
        this,
        "getUnexecutedSequenceTemplateId",
        params,
        getContractByCodeHash
      );
    },
    parseContractUpgrade: async (
      params: TestContractParamsWithoutMaps<
        TokenBridgeFactoryTypes.Fields,
        { payload: HexString }
      >
    ): Promise<
      TestContractResultWithoutMaps<
        [HexString, HexString, HexString, HexString]
      >
    > => {
      return testMethod(
        this,
        "parseContractUpgrade",
        params,
        getContractByCodeHash
      );
    },
  };

  stateForTest(
    initFields: TokenBridgeFactoryTypes.Fields,
    asset?: Asset,
    address?: string
  ) {
    return this.stateForTest_(initFields, asset, address, undefined);
  }
}

// Use this object to test and deploy the contract
export const TokenBridgeFactory = new Factory(
  Contract.fromJson(
    TokenBridgeFactoryContractJson,
    "",
    "b8f3d38c07e360496aaf83fe93eefc04ee4fee57fb5102a628a6c394c67c2e6a",
    []
  )
);

// Use this class to interact with the blockchain
export class TokenBridgeFactoryInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<TokenBridgeFactoryTypes.State> {
    return fetchContractState(TokenBridgeFactory, this);
  }

  view = {
    getLocalTokenPoolTemplateId: async (
      params?: TokenBridgeFactoryTypes.CallMethodParams<"getLocalTokenPoolTemplateId">
    ): Promise<
      TokenBridgeFactoryTypes.CallMethodResult<"getLocalTokenPoolTemplateId">
    > => {
      return callMethod(
        TokenBridgeFactory,
        this,
        "getLocalTokenPoolTemplateId",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getRemoteTokenPoolTemplateId: async (
      params?: TokenBridgeFactoryTypes.CallMethodParams<"getRemoteTokenPoolTemplateId">
    ): Promise<
      TokenBridgeFactoryTypes.CallMethodResult<"getRemoteTokenPoolTemplateId">
    > => {
      return callMethod(
        TokenBridgeFactory,
        this,
        "getRemoteTokenPoolTemplateId",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getTokenBridgeForChainTemplateId: async (
      params?: TokenBridgeFactoryTypes.CallMethodParams<"getTokenBridgeForChainTemplateId">
    ): Promise<
      TokenBridgeFactoryTypes.CallMethodResult<"getTokenBridgeForChainTemplateId">
    > => {
      return callMethod(
        TokenBridgeFactory,
        this,
        "getTokenBridgeForChainTemplateId",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getAttestTokenHandlerTemplateId: async (
      params?: TokenBridgeFactoryTypes.CallMethodParams<"getAttestTokenHandlerTemplateId">
    ): Promise<
      TokenBridgeFactoryTypes.CallMethodResult<"getAttestTokenHandlerTemplateId">
    > => {
      return callMethod(
        TokenBridgeFactory,
        this,
        "getAttestTokenHandlerTemplateId",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    getUnexecutedSequenceTemplateId: async (
      params?: TokenBridgeFactoryTypes.CallMethodParams<"getUnexecutedSequenceTemplateId">
    ): Promise<
      TokenBridgeFactoryTypes.CallMethodResult<"getUnexecutedSequenceTemplateId">
    > => {
      return callMethod(
        TokenBridgeFactory,
        this,
        "getUnexecutedSequenceTemplateId",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
    parseContractUpgrade: async (
      params: TokenBridgeFactoryTypes.CallMethodParams<"parseContractUpgrade">
    ): Promise<
      TokenBridgeFactoryTypes.CallMethodResult<"parseContractUpgrade">
    > => {
      return callMethod(
        TokenBridgeFactory,
        this,
        "parseContractUpgrade",
        params,
        getContractByCodeHash
      );
    },
  };

  transact = {
    getLocalTokenPoolTemplateId: async (
      params: TokenBridgeFactoryTypes.SignExecuteMethodParams<"getLocalTokenPoolTemplateId">
    ): Promise<
      TokenBridgeFactoryTypes.SignExecuteMethodResult<"getLocalTokenPoolTemplateId">
    > => {
      return signExecuteMethod(
        TokenBridgeFactory,
        this,
        "getLocalTokenPoolTemplateId",
        params
      );
    },
    getRemoteTokenPoolTemplateId: async (
      params: TokenBridgeFactoryTypes.SignExecuteMethodParams<"getRemoteTokenPoolTemplateId">
    ): Promise<
      TokenBridgeFactoryTypes.SignExecuteMethodResult<"getRemoteTokenPoolTemplateId">
    > => {
      return signExecuteMethod(
        TokenBridgeFactory,
        this,
        "getRemoteTokenPoolTemplateId",
        params
      );
    },
    getTokenBridgeForChainTemplateId: async (
      params: TokenBridgeFactoryTypes.SignExecuteMethodParams<"getTokenBridgeForChainTemplateId">
    ): Promise<
      TokenBridgeFactoryTypes.SignExecuteMethodResult<"getTokenBridgeForChainTemplateId">
    > => {
      return signExecuteMethod(
        TokenBridgeFactory,
        this,
        "getTokenBridgeForChainTemplateId",
        params
      );
    },
    getAttestTokenHandlerTemplateId: async (
      params: TokenBridgeFactoryTypes.SignExecuteMethodParams<"getAttestTokenHandlerTemplateId">
    ): Promise<
      TokenBridgeFactoryTypes.SignExecuteMethodResult<"getAttestTokenHandlerTemplateId">
    > => {
      return signExecuteMethod(
        TokenBridgeFactory,
        this,
        "getAttestTokenHandlerTemplateId",
        params
      );
    },
    getUnexecutedSequenceTemplateId: async (
      params: TokenBridgeFactoryTypes.SignExecuteMethodParams<"getUnexecutedSequenceTemplateId">
    ): Promise<
      TokenBridgeFactoryTypes.SignExecuteMethodResult<"getUnexecutedSequenceTemplateId">
    > => {
      return signExecuteMethod(
        TokenBridgeFactory,
        this,
        "getUnexecutedSequenceTemplateId",
        params
      );
    },
    parseContractUpgrade: async (
      params: TokenBridgeFactoryTypes.SignExecuteMethodParams<"parseContractUpgrade">
    ): Promise<
      TokenBridgeFactoryTypes.SignExecuteMethodResult<"parseContractUpgrade">
    > => {
      return signExecuteMethod(
        TokenBridgeFactory,
        this,
        "parseContractUpgrade",
        params
      );
    },
  };

  async multicall<Calls extends TokenBridgeFactoryTypes.MultiCallParams>(
    calls: Calls
  ): Promise<TokenBridgeFactoryTypes.MultiCallResults<Calls>>;
  async multicall<Callss extends TokenBridgeFactoryTypes.MultiCallParams[]>(
    callss: Narrow<Callss>
  ): Promise<TokenBridgeFactoryTypes.MulticallReturnType<Callss>>;
  async multicall<
    Callss extends
      | TokenBridgeFactoryTypes.MultiCallParams
      | TokenBridgeFactoryTypes.MultiCallParams[]
  >(callss: Callss): Promise<unknown> {
    return await multicallMethods(
      TokenBridgeFactory,
      this,
      callss,
      getContractByCodeHash
    );
  }
}

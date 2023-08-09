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
import { default as TokenBridgeForChainContractJson } from "../token_bridge/TokenBridgeForChain.ral.json";
import { getContractByCodeHash } from "./contracts";

// Custom types for the contract
export namespace TokenBridgeForChainTypes {
  export type Fields = {
    governance: HexString;
    localChainId: bigint;
    localTokenBridge: HexString;
    remoteChainId: bigint;
    remoteTokenBridgeId: HexString;
    start: bigint;
    firstNext256: bigint;
    secondNext256: bigint;
    unexecutedSequenceTemplateId: HexString;
    sendSequence: bigint;
  };

  export type State = ContractState<Fields>;

  export interface CallMethodTable {
    nextSendSequence: {
      params: Omit<CallContractParams<{}>, "args">;
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

class Factory extends ContractFactory<
  TokenBridgeForChainInstance,
  TokenBridgeForChainTypes.Fields
> {
  consts = {
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

  at(address: string): TokenBridgeForChainInstance {
    return new TokenBridgeForChainInstance(address);
  }

  tests = {
    setExecuted: async (
      params: TestContractParams<
        TokenBridgeForChainTypes.Fields,
        { offset: bigint; current: bigint }
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "setExecuted", params);
    },
    compact: async (
      params: Omit<
        TestContractParams<TokenBridgeForChainTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "compact", params);
    },
    checkSequenceInSubContract: async (
      params: TestContractParams<
        TokenBridgeForChainTypes.Fields,
        { seq: bigint }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "checkSequenceInSubContract", params);
    },
    checkSequence: async (
      params: TestContractParams<
        TokenBridgeForChainTypes.Fields,
        { seq: bigint }
      >
    ): Promise<TestContractResult<boolean>> => {
      return testMethod(this, "checkSequence", params);
    },
    nextSendSequence: async (
      params: Omit<
        TestContractParams<TokenBridgeForChainTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "nextSendSequence", params);
    },
    checkCompleteTransfer: async (
      params: TestContractParams<
        TokenBridgeForChainTypes.Fields,
        { vaa: HexString }
      >
    ): Promise<TestContractResult<[boolean, HexString]>> => {
      return testMethod(this, "checkCompleteTransfer", params);
    },
    parseCompleteTransfer: async (
      params: TestContractParams<
        TokenBridgeForChainTypes.Fields,
        { payload: HexString }
      >
    ): Promise<
      TestContractResult<[bigint, HexString, bigint, Address, bigint]>
    > => {
      return testMethod(this, "parseCompleteTransfer", params);
    },
    completeTransfer: async (
      params: TestContractParams<
        TokenBridgeForChainTypes.Fields,
        { vaa: HexString; caller: Address }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "completeTransfer", params);
    },
    destroyUnexecutedSequenceContracts: async (
      params: TestContractParams<
        TokenBridgeForChainTypes.Fields,
        { paths: HexString }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "destroyUnexecutedSequenceContracts", params);
    },
    deposit: async (
      params: TestContractParams<
        TokenBridgeForChainTypes.Fields,
        { from: Address; alphAmount: bigint }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "deposit", params);
    },
    withdraw: async (
      params: TestContractParams<
        TokenBridgeForChainTypes.Fields,
        { alphAmount: bigint }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "withdraw", params);
    },
  };
}

// Use this object to test and deploy the contract
export const TokenBridgeForChain = new Factory(
  Contract.fromJson(
    TokenBridgeForChainContractJson,
    "",
    "58443a1005d6791f07d0701f4ef91ec367777ab67be27990a6b8fcb7c84e7240"
  )
);

// Use this class to interact with the blockchain
export class TokenBridgeForChainInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<TokenBridgeForChainTypes.State> {
    return fetchContractState(TokenBridgeForChain, this);
  }

  methods = {
    nextSendSequence: async (
      params?: TokenBridgeForChainTypes.CallMethodParams<"nextSendSequence">
    ): Promise<
      TokenBridgeForChainTypes.CallMethodResult<"nextSendSequence">
    > => {
      return callMethod(
        TokenBridgeForChain,
        this,
        "nextSendSequence",
        params === undefined ? {} : params,
        getContractByCodeHash
      );
    },
  };

  async multicall<Calls extends TokenBridgeForChainTypes.MultiCallParams>(
    calls: Calls
  ): Promise<TokenBridgeForChainTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      TokenBridgeForChain,
      this,
      calls,
      getContractByCodeHash
    )) as TokenBridgeForChainTypes.MultiCallResults<Calls>;
  }
}

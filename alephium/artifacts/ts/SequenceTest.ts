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
import { default as SequenceTestContractJson } from "../tests/SequenceTest.ral.json";
import { getContractByCodeHash } from "./contracts";

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

  export interface SignExecuteMethodTable {
    check: {
      params: SignExecuteContractMethodParams<{ seq: bigint }>;
      result: SignExecuteScriptTxResult;
    };
  }
  export type SignExecuteMethodParams<T extends keyof SignExecuteMethodTable> =
    SignExecuteMethodTable[T]["params"];
  export type SignExecuteMethodResult<T extends keyof SignExecuteMethodTable> =
    SignExecuteMethodTable[T]["result"];
}

class Factory extends ContractFactory<
  SequenceTestInstance,
  SequenceTestTypes.Fields
> {
  encodeFields(fields: SequenceTestTypes.Fields) {
    return encodeContractFields(
      addStdIdToFields(this.contract, fields),
      this.contract.fieldsSig,
      []
    );
  }

  getInitialFieldsWithDefaultValues() {
    return this.contract.getInitialFieldsWithDefaultValues() as SequenceTestTypes.Fields;
  }

  consts = {
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
  };

  at(address: string): SequenceTestInstance {
    return new SequenceTestInstance(address);
  }

  tests = {
    setExecuted: async (
      params: TestContractParamsWithoutMaps<
        SequenceTestTypes.Fields,
        { offset: bigint; current: bigint }
      >
    ): Promise<TestContractResultWithoutMaps<bigint>> => {
      return testMethod(this, "setExecuted", params, getContractByCodeHash);
    },
    compact: async (
      params: Omit<
        TestContractParamsWithoutMaps<SequenceTestTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResultWithoutMaps<null>> => {
      return testMethod(this, "compact", params, getContractByCodeHash);
    },
    checkSequenceInSubContract: async (
      params: TestContractParamsWithoutMaps<
        SequenceTestTypes.Fields,
        { seq: bigint }
      >
    ): Promise<TestContractResultWithoutMaps<null>> => {
      return testMethod(
        this,
        "checkSequenceInSubContract",
        params,
        getContractByCodeHash
      );
    },
    checkSequence: async (
      params: TestContractParamsWithoutMaps<
        SequenceTestTypes.Fields,
        { seq: bigint }
      >
    ): Promise<TestContractResultWithoutMaps<boolean>> => {
      return testMethod(this, "checkSequence", params, getContractByCodeHash);
    },
    check: async (
      params: TestContractParamsWithoutMaps<
        SequenceTestTypes.Fields,
        { seq: bigint }
      >
    ): Promise<TestContractResultWithoutMaps<boolean>> => {
      return testMethod(this, "check", params, getContractByCodeHash);
    },
  };
}

// Use this object to test and deploy the contract
export const SequenceTest = new Factory(
  Contract.fromJson(
    SequenceTestContractJson,
    "",
    "e78956e3f4b52df13bc7a82b17c872b3cf6d78c56f8b7dd9edddea6c8c8ddf81",
    []
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
      return callMethod(
        SequenceTest,
        this,
        "check",
        params,
        getContractByCodeHash
      );
    },
  };

  view = this.methods;

  transact = {
    check: async (
      params: SequenceTestTypes.SignExecuteMethodParams<"check">
    ): Promise<SequenceTestTypes.SignExecuteMethodResult<"check">> => {
      return signExecuteMethod(SequenceTest, this, "check", params);
    },
  };

  async multicall<Calls extends SequenceTestTypes.MultiCallParams>(
    calls: Calls
  ): Promise<SequenceTestTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      SequenceTest,
      this,
      calls,
      getContractByCodeHash
    )) as SequenceTestTypes.MultiCallResults<Calls>;
  }
}

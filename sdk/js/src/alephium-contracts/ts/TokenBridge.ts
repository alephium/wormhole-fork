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
import { default as TokenBridgeContractJson } from "../token_bridge/token_bridge.ral.json";

// Custom types for the contract
export namespace TokenBridgeTypes {
  export type Fields = {
    governance: HexString;
    localChainId: bigint;
    receivedSequence: bigint;
    sendSequence: bigint;
    tokenBridgeFactory: HexString;
    minimalConsistencyLevel: bigint;
    refundAddress: Address;
  };

  export type State = ContractState<Fields>;

  export interface CallMethodTable {
    getRefundAddress: {
      params: Omit<CallContractParams<{}>, "args">;
      result: CallContractResult<Address>;
    };
    getMessageFee: {
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
  TokenBridgeInstance,
  TokenBridgeTypes.Fields
> {
  at(address: string): TokenBridgeInstance {
    return new TokenBridgeInstance(address);
  }

  tests = {
    parseAndVerifyGovernanceVAA: async (
      params: TestContractParams<
        TokenBridgeTypes.Fields,
        { vaa: HexString; action: HexString }
      >
    ): Promise<TestContractResult<[bigint, HexString]>> => {
      return testMethod(this, "parseAndVerifyGovernanceVAA", params);
    },
    createAttestTokenHandler: async (
      params: TestContractParams<
        TokenBridgeTypes.Fields,
        {
          payer: Address;
          createContractAlphAmount: bigint;
          remoteChainId: bigint;
          remoteTokenBridgeId: HexString;
          isLocal: boolean;
        }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "createAttestTokenHandler", params);
    },
    createLocalAttestTokenHandler: async (
      params: TestContractParams<
        TokenBridgeTypes.Fields,
        { payer: Address; createContractAlphAmount: bigint }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "createLocalAttestTokenHandler", params);
    },
    parseAndVerifyRegisterChain: async (
      params: TestContractParams<TokenBridgeTypes.Fields, { vaa: HexString }>
    ): Promise<TestContractResult<[bigint, HexString]>> => {
      return testMethod(this, "parseAndVerifyRegisterChain", params);
    },
    registerChain: async (
      params: TestContractParams<
        TokenBridgeTypes.Fields,
        { vaa: HexString; payer: Address; createContractAlphAmount: bigint }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "registerChain", params);
    },
    upgradeContract: async (
      params: TestContractParams<TokenBridgeTypes.Fields, { vaa: HexString }>
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "upgradeContract", params);
    },
    destroyUnexecutedSequenceContracts: async (
      params: TestContractParams<TokenBridgeTypes.Fields, { vaa: HexString }>
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "destroyUnexecutedSequenceContracts", params);
    },
    updateMinimalConsistencyLevel: async (
      params: TestContractParams<TokenBridgeTypes.Fields, { vaa: HexString }>
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "updateMinimalConsistencyLevel", params);
    },
    getRefundAddress: async (
      params: Omit<
        TestContractParams<TokenBridgeTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResult<Address>> => {
      return testMethod(this, "getRefundAddress", params);
    },
    updateRefundAddress: async (
      params: TestContractParams<TokenBridgeTypes.Fields, { vaa: HexString }>
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "updateRefundAddress", params);
    },
    parseConractUpgrade: async (
      params: TestContractParams<
        TokenBridgeTypes.Fields,
        { payload: HexString }
      >
    ): Promise<
      TestContractResult<[HexString, HexString, HexString, HexString]>
    > => {
      return testMethod(this, "parseConractUpgrade", params);
    },
    getMessageFee: async (
      params: Omit<
        TestContractParams<TokenBridgeTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "getMessageFee", params);
    },
    attestToken: async (
      params: TestContractParams<
        TokenBridgeTypes.Fields,
        {
          payer: Address;
          localTokenId: HexString;
          decimals: bigint;
          symbol: HexString;
          name: HexString;
          nonce: HexString;
          consistencyLevel: bigint;
        }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "attestToken", params);
    },
    nextSendSequence: async (
      params: Omit<
        TestContractParams<TokenBridgeTypes.Fields, never>,
        "testArgs"
      >
    ): Promise<TestContractResult<bigint>> => {
      return testMethod(this, "nextSendSequence", params);
    },
    createLocalTokenPool: async (
      params: TestContractParams<
        TokenBridgeTypes.Fields,
        {
          localTokenId: HexString;
          decimals: bigint;
          payer: Address;
          createContractAlphAmount: bigint;
        }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "createLocalTokenPool", params);
    },
    createRemoteTokenPool: async (
      params: TestContractParams<
        TokenBridgeTypes.Fields,
        {
          bridgeTokenId: HexString;
          tokenChainId: bigint;
          decimals: bigint;
          symbol: HexString;
          name: HexString;
          msgSequence: bigint;
          payer: Address;
          createContractAlphAmount: bigint;
        }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "createRemoteTokenPool", params);
    },
    updateRemoteTokenPool: async (
      params: TestContractParams<
        TokenBridgeTypes.Fields,
        {
          bridgeTokenId: HexString;
          tokenChainId: bigint;
          symbol: HexString;
          name: HexString;
          msgSequence: bigint;
        }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "updateRemoteTokenPool", params);
    },
    transferToken: async (
      params: TestContractParams<
        TokenBridgeTypes.Fields,
        {
          fromAddress: Address;
          bridgeTokenId: HexString;
          tokenChainId: bigint;
          toChainId: bigint;
          toAddress: HexString;
          tokenAmount: bigint;
          messageFee: bigint;
          arbiterFee: bigint;
          nonce: HexString;
          consistencyLevel: bigint;
        }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "transferToken", params);
    },
  };
}

// Use this object to test and deploy the contract
export const TokenBridge = new Factory(
  Contract.fromJson(
    TokenBridgeContractJson,
    "",
    "d84e425d2f5be2b343526fe7a2b06d89ac941a1157386e485816fb15ca091c7c"
  )
);

// Use this class to interact with the blockchain
export class TokenBridgeInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<TokenBridgeTypes.State> {
    return fetchContractState(TokenBridge, this);
  }

  methods = {
    getRefundAddress: async (
      params?: TokenBridgeTypes.CallMethodParams<"getRefundAddress">
    ): Promise<TokenBridgeTypes.CallMethodResult<"getRefundAddress">> => {
      return callMethod(
        TokenBridge,
        this,
        "getRefundAddress",
        params === undefined ? {} : params
      );
    },
    getMessageFee: async (
      params?: TokenBridgeTypes.CallMethodParams<"getMessageFee">
    ): Promise<TokenBridgeTypes.CallMethodResult<"getMessageFee">> => {
      return callMethod(
        TokenBridge,
        this,
        "getMessageFee",
        params === undefined ? {} : params
      );
    },
  };

  async multicall<Calls extends TokenBridgeTypes.MultiCallParams>(
    calls: Calls
  ): Promise<TokenBridgeTypes.MultiCallResults<Calls>> {
    return (await multicallMethods(
      TokenBridge,
      this,
      calls
    )) as TokenBridgeTypes.MultiCallResults<Calls>;
  }
}

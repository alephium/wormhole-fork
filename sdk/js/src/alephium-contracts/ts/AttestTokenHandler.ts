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
import { default as AttestTokenHandlerContractJson } from "../token_bridge/attest_token_handler.ral.json";

// Custom types for the contract
export namespace AttestTokenHandlerTypes {
  export type Fields = {
    governance: HexString;
    localTokenBridge: HexString;
    chainId: bigint;
    tokenBridgeId: HexString;
    receivedSequence: bigint;
    isLocalHandler: boolean;
  };

  export type State = ContractState<Fields>;
}

class Factory extends ContractFactory<
  AttestTokenHandlerInstance,
  AttestTokenHandlerTypes.Fields
> {
  at(address: string): AttestTokenHandlerInstance {
    return new AttestTokenHandlerInstance(address);
  }

  tests = {
    parseAttestToken: async (
      params: TestContractParams<
        AttestTokenHandlerTypes.Fields,
        { vaa: HexString }
      >
    ): Promise<
      TestContractResult<[HexString, HexString, HexString, bigint, bigint]>
    > => {
      return testMethod(this, "parseAttestToken", params);
    },
    createLocalTokenPool: async (
      params: TestContractParams<
        AttestTokenHandlerTypes.Fields,
        {
          vaa: HexString;
          payer: Address;
          createContractAlphAmount: bigint;
          tokenAmount: bigint;
        }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "createLocalTokenPool", params);
    },
    createRemoteTokenPool: async (
      params: TestContractParams<
        AttestTokenHandlerTypes.Fields,
        { vaa: HexString; payer: Address; createContractAlphAmount: bigint }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "createRemoteTokenPool", params);
    },
    updateRemoteTokenPool: async (
      params: TestContractParams<
        AttestTokenHandlerTypes.Fields,
        { vaa: HexString }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "updateRemoteTokenPool", params);
    },
  };
}

// Use this object to test and deploy the contract
export const AttestTokenHandler = new Factory(
  Contract.fromJson(
    AttestTokenHandlerContractJson,
    "",
    "741f7658d2746b8d678a329a1ebc1f433ef645c0d4c7e0dc425b958b0a87b8bb"
  )
);

// Use this class to interact with the blockchain
export class AttestTokenHandlerInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<AttestTokenHandlerTypes.State> {
    return fetchContractState(AttestTokenHandler, this);
  }
}

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
import { default as UnexecutedSequenceContractJson } from "../sequence/unexecuted_sequence.ral.json";

// Custom types for the contract
export namespace UnexecutedSequenceTypes {
  export type Fields = {
    parentId: HexString;
    begin: bigint;
    sequences: bigint;
  };

  export type State = ContractState<Fields>;
}

class Factory extends ContractFactory<
  UnexecutedSequenceInstance,
  UnexecutedSequenceTypes.Fields
> {
  at(address: string): UnexecutedSequenceInstance {
    return new UnexecutedSequenceInstance(address);
  }

  tests = {
    checkSequence: async (
      params: TestContractParams<
        UnexecutedSequenceTypes.Fields,
        { seq: bigint; refundAddress: HexString }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "checkSequence", params);
    },
    destroy: async (
      params: TestContractParams<
        UnexecutedSequenceTypes.Fields,
        { refundAddress: HexString }
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "destroy", params);
    },
  };
}

// Use this object to test and deploy the contract
export const UnexecutedSequence = new Factory(
  Contract.fromJson(
    UnexecutedSequenceContractJson,
    "",
    "69f7a18c525aa6707771af5733f39e89bde6ee39ddcc8001c98fd1220c5191c9"
  )
);

// Use this class to interact with the blockchain
export class UnexecutedSequenceInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<UnexecutedSequenceTypes.State> {
    return fetchContractState(UnexecutedSequence, this);
  }
}

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
import { default as BridgeRewardRouterContractJson } from "../token_bridge/BridgeRewardRouter.ral.json";
import { getContractByCodeHash } from "./contracts";

// Custom types for the contract
export namespace BridgeRewardRouterTypes {
  export type State = Omit<ContractState<any>, "fields">;
}

class Factory extends ContractFactory<BridgeRewardRouterInstance, {}> {
  at(address: string): BridgeRewardRouterInstance {
    return new BridgeRewardRouterInstance(address);
  }

  tests = {
    completeTransfer: async (
      params: Omit<
        TestContractParams<
          never,
          { tokenBridgeForChain: HexString; vaa: HexString; caller: Address }
        >,
        "initialFields"
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "completeTransfer", params);
    },
    addRewards: async (
      params: Omit<
        TestContractParams<never, { caller: Address; amount: bigint }>,
        "initialFields"
      >
    ): Promise<TestContractResult<null>> => {
      return testMethod(this, "addRewards", params);
    },
  };
}

// Use this object to test and deploy the contract
export const BridgeRewardRouter = new Factory(
  Contract.fromJson(
    BridgeRewardRouterContractJson,
    "",
    "e9ef2833d1b214a533490f2ca81b7d6d09022bcc0d30a874230d5aca6dfbc57a"
  )
);

// Use this class to interact with the blockchain
export class BridgeRewardRouterInstance extends ContractInstance {
  constructor(address: Address) {
    super(address);
  }

  async fetchState(): Promise<BridgeRewardRouterTypes.State> {
    return fetchContractState(BridgeRewardRouter, this);
  }
}

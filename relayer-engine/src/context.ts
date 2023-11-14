import { ChainId } from "@alephium/wormhole-sdk";
import {
  FetchaVaasOpts,
  ListenerFn,
  ParsedVaaWithBytes,
  RelayerEvents,
} from "./application";
import { Logger } from "winston";
import { NetworkId } from "@alephium/web3";

export type FetchVaaFn = (
  emitterChain: ChainId | string,
  emitterAddress: Uint8Array | string,
  targetChain: ChainId | string,
  sequence: bigint | string,
  opts?: { retryTimeout?: number; retries?: number },
) => Promise<ParsedVaaWithBytes>;

export type FetchVaasFn = (
  opts: FetchaVaasOpts,
) => Promise<ParsedVaaWithBytes[]>;

export interface Context {
  vaa?: ParsedVaaWithBytes;
  vaaBytes?: Uint8Array;
  locals: Record<any, any>;
  fetchVaa: FetchVaaFn;
  fetchVaas: FetchVaasFn;
  processVaa: (vaa: Uint8Array) => Promise<void>;
  networkId: NetworkId;
  logger?: Logger;
  on: (eventName: RelayerEvents, listener: ListenerFn) => void;
  onTxSubmitted: (vaaId: string, txId: string) => Promise<void>;
  config: {
    spyFilters: {
      emitterFilter?: { chainId?: ChainId; emitterAddress?: string };
    }[];
  };
}

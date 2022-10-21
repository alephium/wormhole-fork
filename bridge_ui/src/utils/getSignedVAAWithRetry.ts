import { ChainId, getSignedVAA } from "@h0ngcha0/wormhole-sdk";
import { WORMHOLE_RPC_HOSTS } from "./consts";

export let CURRENT_WORMHOLE_RPC_HOST = -1;

export const getNextRpcHost = () =>
  ++CURRENT_WORMHOLE_RPC_HOST % WORMHOLE_RPC_HOSTS.length;

export async function getSignedVAAWithRetry(
  emitterChain: ChainId,
  emitterAddress: string,
  targetChain: ChainId,
  sequence: string,
  retryAttempts?: number
) {
  let result;
  let attempts = 0;
  while (!result) {
    attempts++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const host = WORMHOLE_RPC_HOSTS[getNextRpcHost()]
      console.log("wormhole host", host)
      console.log("wormhole params", emitterChain, emitterAddress, targetChain, sequence)
      result = await getSignedVAA(
        host,
        emitterChain,
        emitterAddress,
        targetChain,
        sequence
      );
      console.log("result", result)
    } catch (e) {
      if (retryAttempts !== undefined && attempts > retryAttempts) {
        throw e;
      }
    }
  }
  return result;
}

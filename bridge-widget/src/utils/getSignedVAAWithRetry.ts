import { ChainId, getSignedVAA } from "@alephium/wormhole-sdk";
import { getConst } from "./consts";

export let CURRENT_WORMHOLE_RPC_HOST = -1;

export const getNextRpcHost = () =>
  ++CURRENT_WORMHOLE_RPC_HOST % getConst('WORMHOLE_RPC_HOSTS').length;

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
      result = await getSignedVAA(
        getConst('WORMHOLE_RPC_HOSTS')[getNextRpcHost()],
        emitterChain,
        emitterAddress,
        targetChain,
        sequence
      );
    } catch (e) {
      if (retryAttempts !== undefined && attempts > retryAttempts) {
        throw e;
      }
    }
  }
  return result;
}

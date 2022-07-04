import { ChainId, ChainName, coalesceChainId } from "../utils/consts";
import {
  GrpcWebImpl,
  PublicRPCServiceClientImpl,
} from "../proto/publicrpc/v1/publicrpc";

export async function getSignedVAA(
  host: string,
  emitterChain: ChainId | ChainName,
  emitterAddress: string,
  targetChain: ChainId | ChainName,
  sequence: string,
  extraGrpcOpts = {}
) {
  const rpc = new GrpcWebImpl(host, extraGrpcOpts);
  const api = new PublicRPCServiceClientImpl(rpc);
  return await api.GetSignedVAA({
    messageId: {
      emitterChain: coalesceChainId(emitterChain),
      emitterAddress,
      targetChain: coalesceChainId(targetChain),
      sequence,
    },
  });
}

import { ChainId } from "../utils/consts";
import {
  GrpcWebImpl,
  ContractServiceClientImpl
} from "../proto/alephium/v1/alephium";

export async function getTokenWrapperAddress(
  host: string,
  tokenId: string, // hex string
  extraGrpcOpts = {}
) {
  const rpc = new GrpcWebImpl(host, extraGrpcOpts);
  const api = new ContractServiceClientImpl(rpc);
  return await api.GetTokenWrapperAddress({
      tokenId: tokenId
  });
}

export async function getTokenBridgeForChainAddress(
  host: string,
  chainId: ChainId,
  extraGrpcOpts = {}
) {
  const rpc = new GrpcWebImpl(host, extraGrpcOpts);
  const api = new ContractServiceClientImpl(rpc);
  return await api.GetTokenBridgeForChainAddress({
      chainId: chainId
  });
}

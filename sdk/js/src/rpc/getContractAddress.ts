import { ChainId } from "../utils/consts";
import {
  GrpcWebImpl,
  ContractServiceClientImpl
} from "../proto/alephium/v1/alephium";

export async function getLocalTokenWrapperAddress(
  host: string,
  tokenId: string,
  remoteChainId: ChainId,
  extraGrpcOpts = {}
) {
  const rpc = new GrpcWebImpl(host, extraGrpcOpts)
  const api = new ContractServiceClientImpl(rpc);
  return await api.GetLocalTokenWrapperAddress({
    tokenId: tokenId,
    chainId: remoteChainId
  })
}

export async function getRemoteTokenWrapperAddress(
  host: string,
  tokenId: string, // hex string
  extraGrpcOpts = {}
) {
  const rpc = new GrpcWebImpl(host, extraGrpcOpts);
  const api = new ContractServiceClientImpl(rpc);
  return await api.GetRemoteTokenWrapperAddress({
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

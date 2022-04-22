import { ChainId } from "../utils/consts";
import {
  GrpcWebImpl,
  ContractServiceClientImpl
} from "../proto/alephium/v1/alephium";

export async function getLocalTokenWrapperId(
  host: string,
  tokenId: string,
  remoteChainId: ChainId,
  extraGrpcOpts = {}
) {
  const rpc = new GrpcWebImpl(host, extraGrpcOpts)
  const api = new ContractServiceClientImpl(rpc);
  return await api.GetLocalTokenWrapperId({
    tokenId: tokenId,
    chainId: remoteChainId
  })
}

export async function getRemoteTokenWrapperId(
  host: string,
  tokenId: string, // hex string
  extraGrpcOpts = {}
) {
  const rpc = new GrpcWebImpl(host, extraGrpcOpts);
  const api = new ContractServiceClientImpl(rpc);
  return await api.GetRemoteTokenWrapperId({
      tokenId: tokenId
  });
}

export async function getTokenBridgeForChainId(
  host: string,
  chainId: ChainId,
  extraGrpcOpts = {}
) {
  const rpc = new GrpcWebImpl(host, extraGrpcOpts);
  const api = new ContractServiceClientImpl(rpc);
  return await api.GetTokenBridgeForChainId({
      chainId: chainId
  });
}

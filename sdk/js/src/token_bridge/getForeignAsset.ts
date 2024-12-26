import { binToHex, NodeProvider } from "@alephium/web3";
import { ethers } from "ethers";
import { Bridge__factory } from "../ethers-contracts";
import { ChainId, ChainName, coalesceChainId } from "../utils";
import { contractExists, getTokenPoolId } from "./alephium";

export async function getForeignAssetAlephium(
  tokenBridgeId: string,
  provider: NodeProvider,
  originChain: ChainId | ChainName,
  originAsset: Uint8Array,
  groupIndex: number
): Promise<string | null> {
  const remoteTokenPoolId = getTokenPoolId(tokenBridgeId, coalesceChainId(originChain), binToHex(originAsset), groupIndex)
  try {
    const exists = await contractExists(remoteTokenPoolId, provider)
    return exists ? remoteTokenPoolId : null
  } catch (e) {
    return null
  }
}

/**
 * Returns a foreign asset address on Ethereum for a provided native chain and asset address, AddressZero if it does not exist
 * @param tokenBridgeAddress
 * @param provider
 * @param originChain
 * @param originAsset zero pad to 32 bytes
 * @returns
 */
export async function getForeignAssetEth(
  tokenBridgeAddress: string,
  provider: ethers.Signer | ethers.providers.Provider,
  originChain: ChainId | ChainName,
  originAsset: Uint8Array
): Promise<string | null> {
  const tokenBridge = Bridge__factory.connect(tokenBridgeAddress, provider);
  try {
    return await tokenBridge.wrappedAsset(
      coalesceChainId(originChain),
      originAsset
    );
  } catch (e) {
    return null;
  }
}

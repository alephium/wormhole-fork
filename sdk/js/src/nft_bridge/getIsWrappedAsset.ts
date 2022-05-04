import { ethers } from "ethers";
import { Bridge__factory } from "../ethers-contracts";

/**
 * Returns whether or not an asset address on Ethereum is a wormhole wrapped asset
 * @param tokenBridgeAddress
 * @param provider
 * @param assetAddress
 * @returns
 */
export async function getIsWrappedAssetEth(
  tokenBridgeAddress: string,
  provider: ethers.Signer | ethers.providers.Provider,
  assetAddress: string
) {
  if (!assetAddress) return false;
  const tokenBridge = Bridge__factory.connect(tokenBridgeAddress, provider);
  return await tokenBridge.isWrappedAsset(assetAddress);
}

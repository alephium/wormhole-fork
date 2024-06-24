import { Connection } from "@solana/web3.js";
import { ethers } from "ethers";
import { Bridge__factory } from "../ethers-contracts";
import { getWrappedMeta } from "../solana/nftBridge";

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

/**
 * Returns whether or not an asset on Solana is a wormhole wrapped asset
 * @param connection
 * @param nftBridgeAddress
 * @param mintAddress
 * @returns
 */
export async function getIsWrappedAssetSol(
  connection: Connection,
  nftBridgeAddress: string,
  mintAddress: string
) {
  if (!mintAddress) {
    return false;
  }
  return getWrappedMeta(connection, nftBridgeAddress, mintAddress)
    .catch((_) => null)
    .then((meta) => meta != null);
}

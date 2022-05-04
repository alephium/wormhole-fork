import { LCDClient } from "@terra-money/terra.js";
import { ethers } from "ethers";
import { fromUint8Array } from "js-base64";
import { NFTBridge__factory } from "../ethers-contracts";
import { ChainId } from "../utils";

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
  originChain: ChainId,
  originAsset: Uint8Array
): Promise<string | null> {
  const tokenBridge = NFTBridge__factory.connect(tokenBridgeAddress, provider);
  try {
    return await tokenBridge.wrappedAsset(originChain, originAsset);
  } catch (e) {
    return null;
  }
}


/**
 * Returns a foreign asset address on Terra for a provided native chain and asset address
 * @param tokenBridgeAddress
 * @param client
 * @param originChain
 * @param originAsset
 * @returns
 */
export async function getForeignAssetTerra(
  tokenBridgeAddress: string,
  client: LCDClient,
  originChain: ChainId,
  originAsset: Uint8Array,
): Promise<string | null> {
  try {
    const address = fromUint8Array(originAsset);
    const result: { address: string } = await client.wasm.contractQuery(
      tokenBridgeAddress,
      {
        wrapped_registry: {
          chain: originChain,
          address,
        },
      }
    );
    return result.address;
  } catch (e) {
    return null;
  }
}

import { LCDClient } from "@terra-money/terra.js";
import { ethers } from "ethers";
import { arrayify, zeroPad } from "ethers/lib/utils";
import { TokenImplementation__factory } from "../ethers-contracts";
import { buildNativeId, canonicalAddress, isNativeDenom } from "../terra";
import { ChainId, CHAIN_ID_TERRA } from "../utils";
import { getIsWrappedAssetEth } from "./getIsWrappedAsset";

export interface WormholeWrappedInfo {
  isWrapped: boolean;
  chainId: ChainId;
  assetAddress: Uint8Array;
}

/**
 * Returns a origin chain and asset address on {originChain} for a provided Wormhole wrapped address
 * @param tokenBridgeAddress
 * @param provider
 * @param wrappedAddress
 * @returns
 */
export async function getOriginalAssetEth(
  tokenBridgeAddress: string,
  provider: ethers.Signer | ethers.providers.Provider,
  wrappedAddress: string,
  lookupChainId: ChainId
): Promise<WormholeWrappedInfo> {
  const isWrapped = await getIsWrappedAssetEth(
    tokenBridgeAddress,
    provider,
    wrappedAddress
  );
  if (isWrapped) {
    const token = TokenImplementation__factory.connect(
      wrappedAddress,
      provider
    );
    const chainId = (await token.chainId()) as ChainId; // origin chain
    const assetAddress = await token.nativeContract(); // origin address
    return {
      isWrapped: true,
      chainId,
      assetAddress: arrayify(assetAddress),
    };
  }
  return {
    isWrapped: false,
    chainId: lookupChainId,
    assetAddress: zeroPad(arrayify(wrappedAddress), 32),
  };
}

export async function getOriginalAssetTerra(
  client: LCDClient,
  wrappedAddress: string
): Promise<WormholeWrappedInfo> {
  if (isNativeDenom(wrappedAddress)) {
    return {
      isWrapped: false,
      chainId: CHAIN_ID_TERRA,
      assetAddress: buildNativeId(wrappedAddress),
    };
  }
  try {
    const result: {
      asset_address: string;
      asset_chain: ChainId;
      bridge: string;
    } = await client.wasm.contractQuery(wrappedAddress, {
      wrapped_asset_info: {},
    });
    if (result) {
      return {
        isWrapped: true,
        chainId: result.asset_chain,
        assetAddress: new Uint8Array(
          Buffer.from(result.asset_address, "base64")
        ),
      };
    }
  } catch (e) {}
  return {
    isWrapped: false,
    chainId: CHAIN_ID_TERRA,
    assetAddress: zeroPad(canonicalAddress(wrappedAddress), 32),
  };
}

import { ethers } from "ethers";
import { fromUint8Array } from "js-base64";
import { CHAIN_ID_SOLANA } from "..";
import { NFTBridge__factory } from "../ethers-contracts";
import { ChainId, ChainName, coalesceChainId } from "../utils";

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
  const originChainId = coalesceChainId(originChain);
  const tokenBridge = NFTBridge__factory.connect(tokenBridgeAddress, provider);
  try {
    if (originChainId === CHAIN_ID_SOLANA) {
      // All NFTs from Solana are minted to the same address, the originAsset is encoded as the tokenId as
      // BigNumber.from(new PublicKey(originAsset).toBytes()).toString()
      const addr = await tokenBridge.wrappedAsset(
        originChain,
        "0x0101010101010101010101010101010101010101010101010101010101010101"
      );
      return addr;
    }
    return await tokenBridge.wrappedAsset(originChainId, originAsset);
  } catch (e) {
    return null;
  }
}

import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_SOLANA,
  getOriginalAssetEth,
  hexToNativeAssetString,
  isEVMChain,
  uint8ArrayToHex,
  uint8ArrayToNative,
} from "@alephium/wormhole-sdk";
import {
  getOriginalAssetEth as getOriginalAssetEthNFT,
  WormholeWrappedNFTInfo,
} from "@alephium/wormhole-sdk/lib/esm/nft_bridge";
import { Web3Provider } from "@ethersproject/providers";
import { ethers } from "ethers";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Provider,
  useEthereumProvider,
} from "../contexts/EthereumProviderContext";
import { DataWrapper } from "../store/helpers";
import {
  getNFTBridgeAddressForChain,
  getTokenBridgeAddressForChain,
  SOLANA_SYSTEM_PROGRAM_ADDRESS
} from "../utils/consts";
import useIsWalletReady from "./useIsWalletReady";
import { NodeProvider } from "@alephium/web3";
import { getAlephiumTokenWrappedInfo, tryGetContractId } from "../utils/alephium";
import { useWallet } from "@alephium/web3-react";
import i18n from "../i18n";
import { useTranslation } from "react-i18next";

export type OriginalAssetInfo = {
  originChain: ChainId | null;
  originAddress: string | null;
  originTokenId: string | null;
};

export async function getOriginalAssetToken(
  foreignChain: ChainId,
  foreignNativeStringAddress: string,
  ethProvider?: Web3Provider,
  alphNodeProvider?: NodeProvider
) {
  let promise = null;
  try {
    if (isEVMChain(foreignChain) && ethProvider) {
      promise = await getOriginalAssetEth(
        getTokenBridgeAddressForChain(foreignChain),
        ethProvider,
        foreignNativeStringAddress,
        foreignChain
      );
    } else if (foreignChain === CHAIN_ID_ALEPHIUM && alphNodeProvider) {
      const tokenId = tryGetContractId(foreignNativeStringAddress)
      promise = await getAlephiumTokenWrappedInfo(tokenId, alphNodeProvider)
    }
  } catch (e) {
    promise = Promise.reject(i18n.t("Invalid foreign arguments."));
  }
  if (!promise) {
    promise = Promise.reject(i18n.t("Invalid foreign arguments."));
  }
  return promise;
}

export async function getOriginalAssetNFT(
  foreignChain: ChainId,
  foreignNativeStringAddress: string,
  tokenId?: string,
  provider?: Provider
) {
  let promise = null;
  try {
    if (isEVMChain(foreignChain) && provider && tokenId) {
      promise = getOriginalAssetEthNFT(
        getNFTBridgeAddressForChain(foreignChain),
        provider,
        foreignNativeStringAddress,
        tokenId,
        foreignChain
      );
    }
  } catch (e) {
    promise = Promise.reject(i18n.t("Invalid foreign arguments."));
  }
  if (!promise) {
    promise = Promise.reject(i18n.t("Invalid foreign arguments."));
  }
  return promise;
}

//TODO refactor useCheckIfWormholeWrapped to use this function, and probably move to SDK
export async function getOriginalAsset(
  foreignChain: ChainId,
  foreignNativeStringAddress: string,
  nft: boolean,
  tokenId?: string,
  ethProvider?: Provider,
  alphNodeProvider?: NodeProvider
): Promise<WormholeWrappedNFTInfo> {
  const result = nft
    ? await getOriginalAssetNFT(
        foreignChain,
        foreignNativeStringAddress,
        tokenId,
        ethProvider
      )
    : await getOriginalAssetToken(
        foreignChain,
        foreignNativeStringAddress,
        ethProvider,
        alphNodeProvider
      );

  if (
    isEVMChain(result.chainId) &&
    uint8ArrayToNative(result.assetAddress, result.chainId) ===
      ethers.constants.AddressZero
  ) {
    throw new Error(i18n.t("Unable to find address."));
  }
  if (
    result.chainId === CHAIN_ID_SOLANA &&
    uint8ArrayToNative(result.assetAddress, result.chainId) ===
      SOLANA_SYSTEM_PROGRAM_ADDRESS
  ) {
    throw new Error(i18n.t("Unable to find address."));
  }

  return result;
}

//This potentially returns the same chain as the foreign chain, in the case where the asset is native
function useOriginalAsset(
  foreignChain: ChainId,
  foreignAddress: string,
  nft: boolean,
  tokenId?: string
): DataWrapper<OriginalAssetInfo> {
  const { t } = useTranslation();
  const { provider } = useEthereumProvider();
  const { isReady } = useIsWalletReady(foreignChain, false);
  const [originAddress, setOriginAddress] = useState<string | null>(null);
  const [originTokenId, setOriginTokenId] = useState<string | null>(null);
  const [originChain, setOriginChain] = useState<ChainId | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [previousArgs, setPreviousArgs] = useState<{
    foreignChain: ChainId;
    foreignAddress: string;
    nft: boolean;
    tokenId?: string;
  } | null>(null);
  const argsEqual =
    !!previousArgs &&
    previousArgs.foreignChain === foreignChain &&
    previousArgs.foreignAddress === foreignAddress &&
    previousArgs.nft === nft &&
    previousArgs.tokenId === tokenId;
  const setArgs = useCallback(
    () => setPreviousArgs({ foreignChain, foreignAddress, nft, tokenId }),
    [foreignChain, foreignAddress, nft, tokenId]
  );
  const alphWallet = useWallet()

  const argumentError = useMemo(
    () =>
      !foreignChain ||
      !foreignAddress ||
      (isEVMChain(foreignChain) && !isReady) ||
      (isEVMChain(foreignChain) && nft && !tokenId) ||
      argsEqual,
    [isReady, nft, tokenId, argsEqual, foreignChain, foreignAddress]
  );

  useEffect(() => {
    if (!argsEqual) {
      setError("");
      setOriginAddress(null);
      setOriginTokenId(null);
      setOriginChain(null);
      setPreviousArgs(null);
    }
    if (argumentError) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    getOriginalAsset(foreignChain, foreignAddress, nft, tokenId, provider, alphWallet?.nodeProvider)
      .then((result) => {
        if (!cancelled) {
          setIsLoading(false);
          setArgs();
          setOriginAddress(
            hexToNativeAssetString(
              uint8ArrayToHex(result.assetAddress),
              result.chainId
            ) || null
          );
          setOriginTokenId(result.tokenId || null);
          setOriginChain(result.chainId);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setIsLoading(false);
          setError(t("Unable to determine original asset."));
        }
      });
  }, [
    foreignChain,
    foreignAddress,
    nft,
    provider,
    setArgs,
    argumentError,
    tokenId,
    argsEqual,
    alphWallet,
    t
  ]);

  const output: DataWrapper<OriginalAssetInfo> = useMemo(
    () => ({
      error: error,
      isFetching: isLoading,
      data:
        originChain || originAddress || originTokenId
          ? { originChain, originAddress, originTokenId }
          : null,
      receivedAt: null,
    }),
    [isLoading, originAddress, originChain, originTokenId, error]
  );

  return output;
}

export default useOriginalAsset;

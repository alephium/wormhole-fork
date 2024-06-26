import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  getForeignAssetAlephium,
  getForeignAssetAlgorand,
  getForeignAssetEth,
  getForeignAssetSolana,
  getForeignAssetTerra,
  hexToUint8Array,
  isEVMChain,
  nativeToHexString,
} from "@alephium/wormhole-sdk";
import { Connection } from "@solana/web3.js";
import { LCDClient } from "@terra-money/terra.js";
import { ethers } from "ethers";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { DataWrapper } from "../store/helpers";
import {
  ALEPHIUM_BRIDGE_GROUP_INDEX,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  ALGORAND_HOST,
  ALGORAND_TOKEN_BRIDGE_ID,
  getEvmChainId,
  getTokenBridgeAddressForChain,
  SOLANA_HOST,
  SOL_TOKEN_BRIDGE_ADDRESS,
  TERRA_HOST,
  TERRA_TOKEN_BRIDGE_ADDRESS,
} from "../utils/consts";
import useIsWalletReady from "./useIsWalletReady";
import { Algodv2 } from "algosdk";
import { useWallet } from "@alephium/web3-react";
import { useTranslation } from "react-i18next";

export type ForeignAssetInfo = {
  doesExist: boolean;
  address: string | null;
};

function useFetchForeignAsset(
  originChain: ChainId,
  originAsset: string,
  foreignChain: ChainId
): DataWrapper<ForeignAssetInfo> {
  const { t } = useTranslation();
  const { provider, chainId: evmChainId } = useEthereumProvider();
  const { isReady } = useIsWalletReady(foreignChain, false);
  const correctEvmNetwork = getEvmChainId(foreignChain);
  const hasCorrectEvmNetwork = evmChainId === correctEvmNetwork;
  const alphWallet = useWallet();

  const [assetAddress, setAssetAddress] = useState<string | null>(null);
  const [doesExist, setDoesExist] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const originAssetHex = useMemo(() => {
    try {
      return nativeToHexString(originAsset, originChain);
    } catch (e) {
      return null;
    }
  }, [originAsset, originChain]);
  const [previousArgs, setPreviousArgs] = useState<{
    originChain: ChainId;
    originAsset: string;
    foreignChain: ChainId;
  } | null>(null);
  const argsEqual =
    !!previousArgs &&
    previousArgs.originChain === originChain &&
    previousArgs.originAsset === originAsset &&
    previousArgs.foreignChain === foreignChain;
  const setArgs = useCallback(() => {
    setPreviousArgs({ foreignChain, originChain, originAsset });
  }, [foreignChain, originChain, originAsset]);

  const argumentError = useMemo(
    () =>
      !originChain ||
      !originAsset ||
      !foreignChain ||
      !originAssetHex ||
      foreignChain === originChain ||
      (isEVMChain(foreignChain) && !isReady) ||
      (isEVMChain(foreignChain) && !hasCorrectEvmNetwork) ||
      argsEqual,
    [
      isReady,
      foreignChain,
      originAsset,
      originChain,
      hasCorrectEvmNetwork,
      originAssetHex,
      argsEqual,
    ]
  );

  useEffect(() => {
    if (!argsEqual) {
      setAssetAddress(null);
      setError("");
      setDoesExist(null);
      setPreviousArgs(null);
    }
    if (argumentError || !originAssetHex) {
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    try {
      const getterFunc: () => Promise<string | bigint | null> = isEVMChain(
        foreignChain
      )
        ? () =>
            getForeignAssetEth(
              getTokenBridgeAddressForChain(foreignChain),
              provider as any, //why does this typecheck work elsewhere?
              originChain,
              hexToUint8Array(originAssetHex)
            )
        : foreignChain === CHAIN_ID_ALEPHIUM
        ? () => {
          return getForeignAssetAlephium(
            ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
            alphWallet?.nodeProvider!, // we have checked the wallet in `useIsWalletReady`
            originChain,
            hexToUint8Array(originAssetHex),
            ALEPHIUM_BRIDGE_GROUP_INDEX
          )
        }
        : foreignChain === CHAIN_ID_TERRA
        ? () => {
            const lcd = new LCDClient(TERRA_HOST);
            return getForeignAssetTerra(
              TERRA_TOKEN_BRIDGE_ADDRESS,
              lcd,
              originChain,
              hexToUint8Array(originAssetHex)
            );
          }
        : foreignChain === CHAIN_ID_SOLANA
        ? () => {
            const connection = new Connection(SOLANA_HOST, "confirmed");
            return getForeignAssetSolana(
              connection,
              SOL_TOKEN_BRIDGE_ADDRESS,
              originChain,
              hexToUint8Array(originAssetHex)
            );
          }
        : foreignChain === CHAIN_ID_ALGORAND
        ? () => {
            const algodClient = new Algodv2(
              ALGORAND_HOST.algodToken,
              ALGORAND_HOST.algodServer,
              ALGORAND_HOST.algodPort
            );
            return getForeignAssetAlgorand(
              algodClient,
              ALGORAND_TOKEN_BRIDGE_ID,
              originChain,
              originAssetHex
            );
          }
        : () => Promise.resolve(null);

      getterFunc()
        .then((result) => {
          if (!cancelled) {
            if (
              result &&
              !(
                isEVMChain(foreignChain) &&
                result === ethers.constants.AddressZero
              )
            ) {
              setArgs();
              setDoesExist(true);
              setIsLoading(false);
              setAssetAddress(result.toString());
            } else {
              setArgs();
              setDoesExist(false);
              setIsLoading(false);
              setAssetAddress(null);
            }
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setError(t("Could not retrieve the foreign asset."));
            setIsLoading(false);
          }
        });
    } catch (e) {
      //This catch mostly just detects poorly formatted addresses
      if (!cancelled) {
        setError(t("Could not retrieve the foreign asset."));
        setIsLoading(false);
      }
    }
  }, [
    argumentError,
    foreignChain,
    originAssetHex,
    originChain,
    provider,
    alphWallet,
    setArgs,
    argsEqual,
    t
  ]);

  const compoundError = useMemo(() => {
    return error ? error : "";
  }, [error]); //now swallows wallet errors

  const output: DataWrapper<ForeignAssetInfo> = useMemo(
    () => ({
      error: compoundError,
      isFetching: isLoading,
      data:
        (assetAddress !== null && assetAddress !== undefined) ||
        (doesExist !== null && doesExist !== undefined)
          ? { address: assetAddress, doesExist: !!doesExist }
          : null,
      receivedAt: null,
    }),
    [compoundError, isLoading, assetAddress, doesExist]
  );

  return output;
}

export default useFetchForeignAsset;

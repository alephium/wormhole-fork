import { ChainId, isEVMChain } from "@alephium/wormhole-sdk";
import { ethers } from "ethers";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Provider,
  useEthereumProvider,
} from "../contexts/EthereumProviderContext";
import { DataWrapper } from "../store/helpers";
import useIsWalletReady from "./useIsWalletReady";

export type EvmMetadata = {
  symbol?: string;
  logo?: string;
  tokenName?: string;
  decimals?: number;
  balance?: bigint;
};

const ERC20_BASIC_ABI = [
  "function name() view returns (string name)",
  "function symbol() view returns (string symbol)",
  "function decimals() view returns (uint8 decimals)",
  "function balanceOf(address) view returns (uint256)",
];

const handleError = () => {
  return undefined;
};

const fetchSingleMetadata = async (
  address: string,
  provider: Provider,
  walletAddress?: string
): Promise<EvmMetadata> => {
  const contract = new ethers.Contract(address, ERC20_BASIC_ABI, provider);
  const promises = [
    contract.name().catch(handleError),
    contract.symbol().catch(handleError),
    contract.decimals().catch(handleError),
  ]
  if (walletAddress !== undefined) promises.push(contract.balanceOf(walletAddress).catch(handleError))
  const results = await Promise.all(promises);
  return {
    tokenName: results[0],
    symbol: results[1],
    decimals: results[2],
    balance: walletAddress !== undefined ? results[3].toBigInt() : undefined
  };
};

const fetchEthMetadata = async (addresses: string[], provider: Provider, fetchBalance: boolean, walletAddress?: string) => {
  const output = new Map<string, EvmMetadata>();
  if (fetchBalance && walletAddress === undefined) {
    return output
  }
  const promises: Promise<EvmMetadata>[] = [];
  addresses.forEach((address) => {
    promises.push(fetchSingleMetadata(address, provider, walletAddress));
  });
  const resultsArray = await Promise.all(promises);
  addresses.forEach((address, index) => {
    output.set(address, resultsArray[index]);
  });

  return output;
};

function useEvmMetadata(
  addresses: string[],
  chainId: ChainId,
  fetchBalance: boolean,
  walletAddress?: string
): DataWrapper<Map<string, EvmMetadata>> {
  const { t } = useTranslation();
  const { isReady } = useIsWalletReady(chainId, false);
  const { provider } = useEthereumProvider();

  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<Map<string, EvmMetadata> | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (addresses.length && provider && isReady && isEVMChain(chainId)) {
      setIsFetching(true);
      setError("");
      setData(null);
      fetchEthMetadata(addresses, provider, fetchBalance, walletAddress).then(
        (results) => {
          if (!cancelled) {
            setData(results);
            setIsFetching(false);
          }
        },
        () => {
          if (!cancelled) {
            setError(t("Could not retrieve contract metadata"));
            setIsFetching(false);
          }
        }
      );
    }
    return () => {
      cancelled = true;
    };
  }, [addresses, provider, isReady, chainId, walletAddress, fetchBalance, t]);

  return useMemo(
    () => ({
      data,
      isFetching,
      error,
      receivedAt: null,
    }),
    [data, isFetching, error]
  );
}

export default useEvmMetadata;

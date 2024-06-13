import { ethers_contracts } from "@alephium/wormhole-sdk";
import { Signer } from "@ethersproject/abstract-signer";
import { formatUnits } from "@ethersproject/units";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../i18n";

export type EthMigrationInfo = {
  isLoading: boolean;
  error: string;
  data: RequisiteData | null;
};

export type RequisiteData = {
  poolAddress: string;
  fromAddress: string;
  toAddress: string;
  fromToken: ethers_contracts.TokenImplementation;
  toToken: ethers_contracts.TokenImplementation;
  migrator: ethers_contracts.Migrator;
  fromSymbol: string;
  toSymbol: string;
  fromDecimals: number;
  toDecimals: number;
  sharesDecimals: number;
  fromWalletBalance: string;
  toWalletBalance: string;
  fromPoolBalance: string;
  toPoolBalance: string;
  walletSharesBalance: string;
};

const getRequisiteData = async (
  migrator: ethers_contracts.Migrator,
  signer: Signer,
  signerAddress: string
): Promise<RequisiteData> => {
  try {
    const poolAddress = migrator.address;
    const fromAddress = await migrator.fromAsset();
    const toAddress = await migrator.toAsset();

    const fromToken = ethers_contracts.TokenImplementation__factory.connect(fromAddress, signer);
    const toToken = ethers_contracts.TokenImplementation__factory.connect(toAddress, signer);

    const fromSymbol = await fromToken.symbol();
    const toSymbol = await toToken.symbol();

    const fromDecimals = await (await migrator.fromDecimals()).toNumber();
    const toDecimals = await (await migrator.toDecimals()).toNumber();
    const sharesDecimals = await migrator.decimals();

    const fromWalletBalance = formatUnits(
      await fromToken.balanceOf(signerAddress),
      fromDecimals
    );
    const toWalletBalance = formatUnits(
      await toToken.balanceOf(signerAddress),
      toDecimals
    );

    const fromPoolBalance = formatUnits(
      await fromToken.balanceOf(poolAddress),
      fromDecimals
    );
    const toPoolBalance = formatUnits(
      await toToken.balanceOf(poolAddress),
      toDecimals
    );

    const walletSharesBalance = formatUnits(
      await migrator.balanceOf(signerAddress),
      sharesDecimals
    );

    return {
      poolAddress,
      fromAddress,
      toAddress,
      fromToken,
      toToken,
      migrator,
      fromSymbol,
      toSymbol,
      fromDecimals,
      toDecimals,
      fromWalletBalance,
      toWalletBalance,
      fromPoolBalance,
      toPoolBalance,
      walletSharesBalance,
      sharesDecimals,
    };
  } catch (e) {
    return Promise.reject(i18n.t("Failed to retrieve required data."));
  }
};

function useEthereumMigratorInformation(
  migratorAddress: string | undefined,
  signer: Signer | undefined,
  signerAddress: string | undefined,
  toggleRefresh: boolean
): EthMigrationInfo {
  const { t } = useTranslation();
  const migrator = useMemo(
    () =>
      migratorAddress &&
      signer &&
      ethers_contracts.Migrator__factory.connect(migratorAddress, signer),
    [migratorAddress, signer]
  );
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!signer || !migrator || !signerAddress) {
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    getRequisiteData(migrator, signer, signerAddress).then(
      (result) => {
        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      },
      (error) => {
        if (!cancelled) {
          setIsLoading(false);
          setError(t("Failed to retrieve required data."));
        }
      }
    );

    return () => {
      cancelled = true;
      return;
    };
  }, [migrator, signer, signerAddress, toggleRefresh, t]);

  return useMemo(() => {
    if (!migratorAddress || !signer || !signerAddress) {
      return {
        isLoading: false,
        error:
          !signer || !signerAddress
            ? t("Wallet is not connected")
            : !migratorAddress
            ? t("No contract address")
            : t("Error"),
        data: null,
      };
    } else {
      return {
        isLoading,
        error,
        data,
      };
    }
  }, [isLoading, error, data, migratorAddress, signer, signerAddress, t]);
}

export default useEthereumMigratorInformation;

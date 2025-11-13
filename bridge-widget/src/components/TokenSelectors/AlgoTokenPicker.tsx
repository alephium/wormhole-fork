import { CHAIN_ID_ALGORAND } from "@alephium/wormhole-sdk";
import { formatUnits } from "@ethersproject/units";
import { Algodv2 } from "algosdk";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { fetchSingleMetadata } from "../../hooks/useAlgoMetadata";
import { createParsedTokenAccount } from "../../hooks/useGetSourceParsedTokenAccounts";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import type { DataWrapper } from "../../store/helpers";
import type { NFTParsedTokenAccount } from "../../store/nftSlice";
import type { ParsedTokenAccount } from "../../store/transferSlice";
import { ALGORAND_HOST } from "../../utils/consts";
import TokenPicker, { BasicAccountRender } from "./TokenPicker";

type AlgoTokenPickerProps = {
  value: ParsedTokenAccount | null;
  onChange: (newValue: ParsedTokenAccount | null) => void;
  tokenAccounts: DataWrapper<ParsedTokenAccount[]> | undefined;
  disabled: boolean;
  resetAccounts: (() => void) | undefined;
};

const returnsFalse = () => false;

export default function AlgoTokenPicker(props: AlgoTokenPickerProps) {
  const { t } = useTranslation();
  const { value, onChange, disabled, tokenAccounts, resetAccounts } = props;
  const { walletAddress } = useIsWalletReady(CHAIN_ID_ALGORAND);

  const resetAccountWrapper = useCallback(() => {
    resetAccounts?.();
  }, [resetAccounts]);
  const isLoading = tokenAccounts?.isFetching || false;

  const onChangeWrapper = useCallback(
    async (account: NFTParsedTokenAccount | null) => {
      if (account === null) {
        onChange(null);
        return Promise.resolve();
      }
      onChange(account);
      return Promise.resolve();
    },
    [onChange]
  );

  const lookupAlgoAddress = useCallback(
    (lookupAsset: string) => {
      if (!walletAddress) {
        return Promise.reject(t("Wallet is not connected."));
      }
      const algodClient = new Algodv2(
        ALGORAND_HOST.algodToken,
        ALGORAND_HOST.algodServer,
        ALGORAND_HOST.algodPort
      );
      return fetchSingleMetadata(lookupAsset, algodClient)
        .then((metadata) => {
          return algodClient
            .accountInformation(walletAddress)
            .do()
            .then((accountInfo) => {
              for (const asset of accountInfo.assets) {
                const assetId = asset["asset-id"];
                if (assetId.toString() === lookupAsset) {
                  const amount = asset.amount;
                  return createParsedTokenAccount(
                    walletAddress,
                    assetId.toString(),
                    amount,
                    metadata.decimals,
                    parseFloat(formatUnits(amount, metadata.decimals)),
                    formatUnits(amount, metadata.decimals).toString(),
                    metadata.symbol,
                    metadata.tokenName,
                    undefined,
                    false
                  );
                }
              }
              return Promise.reject();
            })
            .catch(() => Promise.reject());
        })
        .catch(() => Promise.reject());
    },
    [walletAddress, t]
  );

  const isSearchableAddress = useCallback((address: string) => {
    if (address.length === 0) {
      return false;
    }
    try {
      parseInt(address);
      return true;
    } catch (e) {
      return false;
    }
  }, []);

  const RenderComp = useCallback(
    ({ account }: { account: NFTParsedTokenAccount }) => {
      return BasicAccountRender(account, returnsFalse, false);
    },
    []
  );

  return (
    <TokenPicker
      value={value}
      options={tokenAccounts?.data || []}
      RenderOption={RenderComp}
      onChange={onChangeWrapper}
      isValidAddress={isSearchableAddress}
      getAddress={lookupAlgoAddress}
      disabled={disabled}
      resetAccounts={resetAccountWrapper}
      error={""}
      showLoader={isLoading}
      nft={false}
      chainId={CHAIN_ID_ALGORAND}
    />
  );
}

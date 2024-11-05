import { ChainId, CHAIN_ID_ETH, ethers_contracts } from "@alephium/wormhole-sdk";
import { WormholeAbi__factory } from "@alephium/wormhole-sdk/lib/esm/ethers-contracts/abi";
import { getAddress as getEthAddress } from "@ethersproject/address";
import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useEthereumProvider } from "../../contexts/EthereumProviderContext";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import { DataWrapper } from "../../store/helpers";
import { NFTParsedTokenAccount } from "../../store/nftSlice";
import { ParsedTokenAccount } from "../../store/transferSlice";
import {
  getMigrationAssetMap,
  WORMHOLE_V1_ETH_ADDRESS,
} from "../../utils/consts";
import {
  ethNFTToNFTParsedTokenAccount,
  ethTokenToParsedTokenAccount,
  getEthereumNFT,
  getEthereumToken,
  isValidEthereumAddress,
} from "../../utils/evm";
import TokenPicker, { BasicAccountRender } from "./TokenPicker";
import { getTokenLogoAndSymbol } from "../../utils/tokens";

const isWormholev1 = (provider: any, address: string, chainId: ChainId) => {
  if (chainId !== CHAIN_ID_ETH) {
    return Promise.resolve(false);
  }
  const connection = WormholeAbi__factory.connect(
    WORMHOLE_V1_ETH_ADDRESS,
    provider
  );
  return connection.isWrappedAsset(address);
};

type EthereumSourceTokenSelectorProps = {
  value: ParsedTokenAccount | null;
  onChange: (newValue: ParsedTokenAccount | null) => void;
  tokenAccounts: DataWrapper<ParsedTokenAccount[]> | undefined;
  disabled: boolean;
  resetAccounts: (() => void) | undefined;
  chainId: ChainId;
  nft?: boolean;
};

export default function EvmTokenPicker(
  props: EthereumSourceTokenSelectorProps
) {
  const { t } = useTranslation();
  const {
    value,
    onChange,
    tokenAccounts,
    disabled,
    resetAccounts,
    chainId,
    nft,
  } = props;
  const { provider, signerAddress } = useEthereumProvider();
  const { isReady } = useIsWalletReady(chainId);

  const isMigrationEligible = useCallback(
    (address: string) => {
      const assetMap = getMigrationAssetMap(chainId);
      return !!assetMap.get(getEthAddress(address));
    },
    [chainId]
  );

  const getAddress: (
    address: string,
    tokenId?: string
  ) => Promise<NFTParsedTokenAccount> = useCallback(
    async (address: string, tokenId?: string) => {
      if (provider && signerAddress && isReady) {
        try {
          const tokenAccount = await (nft
            ? getEthereumNFT(address, provider)
            : getEthereumToken(address, provider));
          if (!tokenAccount) {
            return Promise.reject(t("Unable to retrive the specific token."));
          }
          if (nft && !tokenId) {
            return Promise.reject(t("Token ID is required."));
          } else if (nft && tokenId) {
            return ethNFTToNFTParsedTokenAccount(
              tokenAccount as ethers_contracts.NFTImplementation,
              tokenId,
              signerAddress
            );
          } else {
            const logoAndSymbol = await getTokenLogoAndSymbol(chainId, tokenAccount.address)
            const tokenInfo = await ethTokenToParsedTokenAccount(
              chainId,
              tokenAccount as ethers_contracts.TokenImplementation,
              signerAddress
            );
            return {
              ...tokenInfo,
              symbol: logoAndSymbol?.symbol ?? tokenInfo.symbol,
              logo: logoAndSymbol?.logoURI ?? tokenInfo.logo
            }
          }
        } catch (e) {
          return Promise.reject(t("Unable to retrive the specific token."));
        }
      } else {
        return Promise.reject({ error: t("Wallet is not connected.") });
      }
    },
    [isReady, nft, provider, signerAddress, t, chainId]
  );

  const onChangeWrapper = useCallback(
    async (account: NFTParsedTokenAccount | null) => {
      if (account === null) {
        onChange(null);
        return Promise.resolve();
      }
      let v1 = false;
      try {
        v1 = await isWormholev1(provider, account.mintKey, chainId);
      } catch (e) {
        //For now, just swallow this one.
      }
      const migration = isMigrationEligible(account.mintKey);
      if (v1 === true && !migration) {
        throw new Error(
          t("Wormhole v1 assets cannot be transferred with this bridge.")
        );
      }
      onChange(account);
      return Promise.resolve();
    },
    [chainId, onChange, provider, isMigrationEligible, t]
  );

  const RenderComp = useCallback(
    ({ account }: { account: NFTParsedTokenAccount }) => {
      return BasicAccountRender(
        account,
        isMigrationEligible,
        nft || false,
        (_: NFTParsedTokenAccount) => true
      );
    },
    [nft, isMigrationEligible]
  );

  return (
    <TokenPicker
      value={value}
      options={tokenAccounts?.data || []}
      RenderOption={RenderComp}
      useTokenId={nft}
      onChange={onChangeWrapper}
      isValidAddress={isValidEthereumAddress}
      getAddress={getAddress}
      disabled={disabled}
      resetAccounts={resetAccounts}
      error={""}
      showLoader={tokenAccounts?.isFetching}
      nft={nft || false}
      chainId={chainId}
    />
  );
}

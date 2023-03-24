import { CHAIN_ID_ALEPHIUM } from "alephium-wormhole-sdk";
import { ALPH as ALPHTokenInfo } from '@alephium/token-list'
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataWrapper } from "../../store/helpers";
import { ParsedTokenAccount } from "../../store/transferSlice";
import TokenPicker, { BasicAccountRender } from "./TokenPicker";
import { ALPH_TOKEN_ID, NodeProvider } from "@alephium/web3";
import { formatUnits } from "ethers/lib/utils";
import { createParsedTokenAccount } from "../../hooks/useGetSourceParsedTokenAccounts";
import { getAlephiumTokenInfo, getAvailableBalances } from "../../utils/alephium";
import alephiumIcon from "../../icons/alephium.svg";
import { useAlephiumWallet } from "../../hooks/useAlephiumWallet";

type AlephiumTokenPickerProps = {
  value: ParsedTokenAccount | null;
  onChange: (newValue: ParsedTokenAccount | null) => void;
  tokenAccounts: DataWrapper<ParsedTokenAccount[]> | undefined;
  disabled: boolean;
  resetAccounts: (() => void) | undefined;
};

async function getAlephiumTokenAccounts(provider: NodeProvider, address: string): Promise<ParsedTokenAccount[]> {
  const balances = await getAvailableBalances(provider, address)
  const tokenAccounts: ParsedTokenAccount[] = []
  for (const [tokenId, amount] of balances) {
    const tokenInfo = tokenId === ALPH_TOKEN_ID ? ALPHTokenInfo : (await getAlephiumTokenInfo(provider, tokenId))
    if (tokenInfo === undefined) {
      continue
    }
    const uiAmount = formatUnits(amount, tokenInfo.decimals)
    tokenAccounts.push(createParsedTokenAccount(
      address,
      tokenId,
      amount.toString(),
      tokenInfo.decimals,
      parseFloat(uiAmount),
      uiAmount,
      tokenInfo.symbol,
      tokenInfo.name,
      tokenId === ALPH_TOKEN_ID ? alephiumIcon : tokenInfo.logoURI,
      tokenId === ALPH_TOKEN_ID
    ))
  }

  return tokenAccounts
}

function useAlephiumTokenAccounts(refresh: Boolean, onRefreshCompleted: () => void) {
  const [isLoading, setIsLoading] = useState(true);
  const [tokenAccounts, setTokenAccounts] = useState<ParsedTokenAccount[]>([]);
  const wallet = useAlephiumWallet()

  useEffect(() => {
    if (!refresh) {
      return
    }
    if (wallet?.nodeProvider === undefined) {
      setIsLoading(false)
      setTokenAccounts([])
    } else {
      setIsLoading(true)
      setTokenAccounts([])
      getAlephiumTokenAccounts(wallet.nodeProvider, wallet.address)
        .then((tokenAccounts) => {
          setTokenAccounts(tokenAccounts)
          onRefreshCompleted()
          setIsLoading(false)
        })
        .catch((e) => {
          console.log("failed to load alephium token accounts, error: " + e)
          setIsLoading(false)
          onRefreshCompleted()
          setTokenAccounts([])
        })
      }
    }, [wallet, refresh, onRefreshCompleted])
  return useMemo(() => ({isLoading, tokenAccounts}), [isLoading, tokenAccounts])
}

const returnsFalse = () => false;

export default function AlephiumTokenPicker(props: AlephiumTokenPickerProps) {
  const { value, onChange, disabled } = props;
  const [refresh, setRefresh] = useState<boolean>(true)

  const onRefreshCompleted = useCallback(() => setRefresh(false), [])

  const { isLoading, tokenAccounts } = useAlephiumTokenAccounts(refresh, onRefreshCompleted);

  const resetAccounts = useCallback(() => {
    if (isLoading) {
      return
    }
    setRefresh(true)
  }, [isLoading])

  const onChangeWrapper = useCallback(
    async (account: ParsedTokenAccount | null) => {
      if (account === null) {
        onChange(null);
        return Promise.resolve();
      }
      onChange(account);
      return Promise.resolve();
    },
    [onChange]
  );

  const isSearchableAddress = useCallback((address: string) => {
      return true
  }, []);

  const RenderComp = useCallback(
    ({ account }: { account: ParsedTokenAccount }) => {
      return BasicAccountRender(account, returnsFalse, false);
    },
    []
  );

  return (
    <TokenPicker
      value={value}
      options={tokenAccounts}
      RenderOption={RenderComp}
      onChange={onChangeWrapper}
      isValidAddress={isSearchableAddress}
      disabled={disabled}
      resetAccounts={resetAccounts}
      error={""}
      showLoader={isLoading}
      nft={false}
      chainId={CHAIN_ID_ALEPHIUM}
    />
  );
}

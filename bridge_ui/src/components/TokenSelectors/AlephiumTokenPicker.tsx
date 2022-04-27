import { CHAIN_ID_ALEPHIUM } from "@certusone/wormhole-sdk";
import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataWrapper } from "../../store/helpers";
import { ParsedTokenAccount } from "../../store/transferSlice";
import TokenPicker, { BasicAccountRender } from "./TokenPicker";
import { CliqueClient } from "alephium-web3";
import { ALEPHIUM_HOST } from "../../utils/consts";
import { formatUnits } from "ethers/lib/utils";
import { createParsedTokenAccount } from "../../hooks/useGetSourceParsedTokenAccounts";
import { useAlephiumWallet } from "../../contexts/AlephiumWalletContext";

type AlephiumTokenPickerProps = {
  value: ParsedTokenAccount | null;
  onChange: (newValue: ParsedTokenAccount | null) => void;
  tokenAccounts: DataWrapper<ParsedTokenAccount[]> | undefined;
  disabled: boolean;
  resetAccounts: (() => void) | undefined;
};

function useAlephiumTokenAccounts(refreshRef: MutableRefObject<() => void>) {
  const [isLoading, setIsLoading] = useState(true);
  const [tokenAccounts, setTokenAccounts] = useState<ParsedTokenAccount[]>([]);
  const [refresh, setRefresh] = useState(false);
  const wallet = useAlephiumWallet()
  useEffect(() => {
    if (refreshRef) {
      refreshRef.current = () => {
        setRefresh(true)
        setTokenAccounts([])
      };
    }
  }, [refreshRef]);
  useEffect(() => {
    setRefresh(false)
    setIsLoading(true)
    const client = new CliqueClient({baseUrl: ALEPHIUM_HOST})
    client
      .addresses
      .getAddressesAddressUtxos(wallet.address)
      .then((response) => {
        let now = Date.now();
        let tokenAmounts = new Map<string, bigint>();
        response.data.utxos.forEach(utxo => {
          if (now > utxo.lockTime) {
            utxo.tokens.forEach(token => {
              const amount = tokenAmounts.get(token.id)
              if (amount) {
                tokenAmounts.set(token.id, amount + BigInt(token.amount))
              } else {
                tokenAmounts.set(token.id, BigInt(token.amount))
              }
            })
          }
        });

        setTokenAccounts(Array.from(tokenAmounts).map(([tokenId, amount]) => {
          // TODO: get token decimals
          const decimals = 8
          const uiAmount = formatUnits(amount, decimals)
          return createParsedTokenAccount(
            wallet.address,
            tokenId,
            amount.toString(),
            decimals,
            parseFloat(uiAmount),
            uiAmount
          )
        }))
        setIsLoading(false)
      })
      .catch((e) => {
        setIsLoading(false)
        setTokenAccounts([])
      })
    }, [wallet, refresh])
    const value = useMemo(() => ({isLoading, tokenAccounts}), [isLoading, tokenAccounts])
    return value
}

const returnsFalse = () => false;

export default function AlephiumTokenPicker(props: AlephiumTokenPickerProps) {
  const { value, onChange, disabled } = props;
  const nativeRefresh = useRef<() => void>(() => {});
  const resetAccountWrapper = useCallback(() => {
    nativeRefresh.current()
  }, []);
  const { isLoading, tokenAccounts } = useAlephiumTokenAccounts(nativeRefresh);

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
      resetAccounts={resetAccountWrapper}
      error={""}
      showLoader={isLoading}
      nft={false}
      chainId={CHAIN_ID_ALEPHIUM}
    />
  );
}

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
import { getAlephiumTokenInfo } from "../../utils/alephium";

type AlephiumTokenPickerProps = {
  value: ParsedTokenAccount | null;
  onChange: (newValue: ParsedTokenAccount | null) => void;
  tokenAccounts: DataWrapper<ParsedTokenAccount[]> | undefined;
  disabled: boolean;
  resetAccounts: (() => void) | undefined;
};

async function getAlephiumTokenAccounts(address: string): Promise<ParsedTokenAccount[]> {
  const client = new CliqueClient({baseUrl: ALEPHIUM_HOST})
  const utxos = await client.addresses.getAddressesAddressUtxos(address)
  const now = Date.now()
  let tokenAmounts = new Map<string, bigint>()
  utxos.data.utxos.forEach(utxo => {
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

  let tokenAccounts = []
  for (let [tokenId, amount] of tokenAmounts) {
    const tokenInfo = await getAlephiumTokenInfo(client, tokenId)
    const uiAmount = formatUnits(amount, tokenInfo.decimals)
    const tokenAccount = createParsedTokenAccount(
      address, tokenId, amount.toString(), tokenInfo.decimals, parseFloat(uiAmount), uiAmount
    )
    tokenAccounts.push(tokenAccount)
  }
  return tokenAccounts
}

function useAlephiumTokenAccounts(refreshRef: MutableRefObject<() => void>) {
  const [isLoading, setIsLoading] = useState(true);
  const [tokenAccounts, setTokenAccounts] = useState<ParsedTokenAccount[]>([]);
  const [refresh, setRefresh] = useState(false);
  const { signer } = useAlephiumWallet()
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
    if (typeof signer === 'undefined') {
      setIsLoading(false)
      setTokenAccounts([])
    } else {
      getAlephiumTokenAccounts(signer.account.address)
        .then((tokenAccounts) => {
          setTokenAccounts(tokenAccounts)
          setIsLoading(false)
        })
        .catch((e) => {
          console.log("failed to load alephium token accounts, error: " + e)
          setIsLoading(false)
          setTokenAccounts([])
        })
      }
    }, [signer, refresh])
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

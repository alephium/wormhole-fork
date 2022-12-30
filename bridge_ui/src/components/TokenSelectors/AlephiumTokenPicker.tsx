import { CHAIN_ID_ALEPHIUM } from "alephium-wormhole-sdk";
import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataWrapper } from "../../store/helpers";
import { ParsedTokenAccount } from "../../store/transferSlice";
import TokenPicker, { BasicAccountRender } from "./TokenPicker";
import { NodeProvider } from "@alephium/web3";
import { formatUnits } from "ethers/lib/utils";
import { createParsedTokenAccount } from "../../hooks/useGetSourceParsedTokenAccounts";
import { useAlephiumWallet } from "../../contexts/AlephiumWalletContext";
import { getAlephiumTokenInfo } from "../../utils/alephium";
import { ALEPHIUM_WRAPPED_ALPH_CONTRACT_ID } from "../../utils/consts";
import alephiumIcon from "../../icons/alephium.svg";

type AlephiumTokenPickerProps = {
  value: ParsedTokenAccount | null;
  onChange: (newValue: ParsedTokenAccount | null) => void;
  tokenAccounts: DataWrapper<ParsedTokenAccount[]> | undefined;
  disabled: boolean;
  resetAccounts: (() => void) | undefined;
};

async function getAlephiumTokenAccounts(address: string, client: NodeProvider): Promise<ParsedTokenAccount[]> {
  const utxos = await client.addresses.getAddressesAddressUtxos(address)
  const now = Date.now()
  let alphAmount: bigint = BigInt(0)
  let tokenAmounts = new Map<string, bigint>()
  console.log("Get token from address", address)
  utxos.utxos.forEach(utxo => {
    alphAmount = alphAmount + BigInt(utxo.amount)
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
  const alphUIAmount = formatUnits(alphAmount, 18)
  const alph = createParsedTokenAccount(
    address,
    ALEPHIUM_WRAPPED_ALPH_CONTRACT_ID,
    alphAmount.toString(),
    18,
    parseFloat(alphUIAmount),
    alphUIAmount,
    "ALPH",
    "ALPH",
    alephiumIcon,
    true
  )
  console.log("ALPH token", address)

  let tokenAccounts = [alph]
  for (let [tokenId, amount] of tokenAmounts) {
    const tokenInfo = await getAlephiumTokenInfo(client, tokenId)
    if (typeof tokenInfo === 'undefined') {
      continue
    }
    const uiAmount = formatUnits(amount, tokenInfo.decimals)
    const tokenAccount = createParsedTokenAccount(
      address, tokenId, amount.toString(), tokenInfo.decimals, parseFloat(uiAmount), uiAmount
    )
    tokenAccounts.push(tokenAccount)
  }
  console.log("tokenAccounts", tokenAccounts)
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
      getAlephiumTokenAccounts(signer.account.address, signer.nodeProvider)
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

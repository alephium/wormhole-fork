import { CHAIN_ID_ALEPHIUM } from "alephium-wormhole-sdk";
import { useCallback } from "react";
import { DataWrapper } from "../../store/helpers";
import { ParsedTokenAccount } from "../../store/transferSlice";
import TokenPicker, { BasicAccountRender } from "./TokenPicker";

type AlephiumTokenPickerProps = {
  value: ParsedTokenAccount | null;
  onChange: (newValue: ParsedTokenAccount | null) => void;
  tokenAccounts: DataWrapper<ParsedTokenAccount[]> | undefined;
  disabled: boolean;
  resetAccounts: (() => void) | undefined;
};

const returnsFalse = () => false;

export default function AlephiumTokenPicker(props: AlephiumTokenPickerProps) {
  const { value, onChange, disabled, tokenAccounts, resetAccounts } = props

  const resetAccountWrapper = useCallback(() => {
    resetAccounts && resetAccounts();
  }, [resetAccounts]);
  const isLoading = tokenAccounts?.isFetching || false

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
      return false
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
      options={tokenAccounts?.data || []}
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

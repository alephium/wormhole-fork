//import Autocomplete from '@material-ui/lab/Autocomplete';
import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  isEVMChain,
} from "@alephium/wormhole-sdk";
import { TextField, Typography } from "@material-ui/core";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import useGetSourceParsedTokens from "../../hooks/useGetSourceParsedTokenAccounts";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import {
  setSourceParsedTokenAccount as setNFTSourceParsedTokenAccount,
  setSourceWalletAddress as setNFTSourceWalletAddress,
} from "../../store/nftSlice";
import {
  selectNFTSourceChain,
  selectNFTSourceParsedTokenAccount,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccount,
} from "../../store/selectors";
import {
  ParsedTokenAccount,
  setSourceParsedTokenAccount as setTransferSourceParsedTokenAccount,
  setSourceWalletAddress as setTransferSourceWalletAddress,
} from "../../store/transferSlice";
import AlephiumTokenPicker from "./AlephiumTokenPicker";
import AlgoTokenPicker from "./AlgoTokenPicker";
import EvmTokenPicker from "./EvmTokenPicker";
import RefreshButtonWrapper from "./RefreshButtonWrapper";
import SolanaTokenPicker from "./SolanaTokenPicker";

type TokenSelectorProps = {
  disabled: boolean;
  nft?: boolean;
};

export const TokenSelector = (props: TokenSelectorProps) => {
  const { t } = useTranslation();
  const { disabled, nft } = props;
  const dispatch = useDispatch();

  const lookupChain = useSelector(
    nft ? selectNFTSourceChain : selectTransferSourceChain
  );
  const sourceParsedTokenAccount = useSelector(
    nft
      ? selectNFTSourceParsedTokenAccount
      : selectTransferSourceParsedTokenAccount
  );
  const walletIsReady = useIsWalletReady(lookupChain);

  const setSourceParsedTokenAccount = nft
    ? setNFTSourceParsedTokenAccount
    : setTransferSourceParsedTokenAccount;
  const setSourceWalletAddress = nft
    ? setNFTSourceWalletAddress
    : setTransferSourceWalletAddress;

  const handleOnChange = useCallback(
    (newTokenAccount: ParsedTokenAccount | null) => {
      if (!newTokenAccount) {
        dispatch(setSourceParsedTokenAccount(undefined));
        dispatch(setSourceWalletAddress(undefined));
      } else if (newTokenAccount !== undefined && walletIsReady.walletAddress) {
        dispatch(setSourceParsedTokenAccount(newTokenAccount));
        dispatch(setSourceWalletAddress(walletIsReady.walletAddress));
      }
    },
    [
      dispatch,
      walletIsReady,
      setSourceParsedTokenAccount,
      setSourceWalletAddress,
    ]
  );

  const maps = useGetSourceParsedTokens(nft);
  const resetAccountWrapper = maps?.resetAccounts || (() => {}); //This should never happen.

  //This is only for errors so bad that we shouldn't even mount the component
  const fatalError =
    !isEVMChain(lookupChain) &&
    lookupChain !== CHAIN_ID_TERRA &&
    maps?.tokenAccounts?.error; //Terra & ETH can proceed because it has advanced mode

  const content = fatalError ? (
    <RefreshButtonWrapper callback={resetAccountWrapper}>
      <Typography>{fatalError}</Typography>
    </RefreshButtonWrapper>
  ) : lookupChain === CHAIN_ID_SOLANA ? (
    <SolanaTokenPicker
      value={sourceParsedTokenAccount || null}
      onChange={handleOnChange}
      disabled={disabled}
      accounts={maps?.tokenAccounts}
      mintAccounts={maps?.mintAccounts}
      resetAccounts={maps?.resetAccounts}
      nft={nft}
    />
  ) : isEVMChain(lookupChain) ? (
    <EvmTokenPicker
      value={sourceParsedTokenAccount || null}
      disabled={disabled}
      onChange={handleOnChange}
      tokenAccounts={maps?.tokenAccounts}
      resetAccounts={maps?.resetAccounts}
      chainId={lookupChain}
      nft={nft}
    />
  ) : lookupChain === CHAIN_ID_ALEPHIUM ? (
    <AlephiumTokenPicker
      value={sourceParsedTokenAccount || null}
      disabled={disabled}
      onChange={handleOnChange}
      resetAccounts={maps?.resetAccounts}
      tokens={maps?.tokens}
      isFetching={maps?.isFetching || false}
      balances={maps?.balances || new Map<string, bigint>()}
    />
  ) : lookupChain === CHAIN_ID_ALGORAND ? (
    <AlgoTokenPicker
      value={sourceParsedTokenAccount || null}
      disabled={disabled}
      onChange={handleOnChange}
      resetAccounts={maps?.resetAccounts}
      tokenAccounts={maps?.tokenAccounts}
    />
  ) : (
    <TextField
      variant="outlined"
      placeholder={t("Asset")}
      fullWidth
      value={t("Not Implemented")}
      disabled={true}
    />
  );

  return <div>{content}</div>;
};

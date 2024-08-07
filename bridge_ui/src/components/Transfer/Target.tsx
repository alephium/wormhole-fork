import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_SOLANA,
  hexToNativeString
} from "@alephium/wormhole-sdk";
import { makeStyles, Typography } from "@material-ui/core";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import useGetTargetParsedTokenAccounts from "../../hooks/useGetTargetParsedTokenAccounts";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import useSyncTargetAddress from "../../hooks/useSyncTargetAddress";
import {
  selectTransferAmount,
  selectTransferIsTargetComplete,
  selectTransferShouldLockFields,
  selectTransferSourceAssetInfoWrapper,
  selectTransferSourceChain,
  selectTransferTargetAddressHex,
  selectTransferTargetAsset,
  selectTransferTargetAssetWrapper,
  selectTransferTargetBalanceString,
  selectTransferTargetChain,
  selectTransferTargetError,
  selectTransferTargetParsedTokenAccount,
} from "../../store/selectors";
import { incrementStep, setTargetChain } from "../../store/transferSlice";
import { CHAINS, CLUSTER } from "../../utils/consts";
import ButtonWithLoader from "../ButtonWithLoader";
import ChainSelect from "../ChainSelect";
import KeyAndBalance from "../KeyAndBalance";
import LowBalanceWarning from "../LowBalanceWarning";
import SmartAddress from "../SmartAddress";
import SolanaCreateAssociatedAddress, {
  useAssociatedAccountExistsState,
} from "../SolanaCreateAssociatedAddress";
import SolanaTPSWarning from "../SolanaTPSWarning";
import StepDescription from "../StepDescription";
import RegisterNowButton from "./RegisterNowButton";
import { hexToALPHAddress } from "../../utils/alephium";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles((theme) => ({
  transferField: {
    marginTop: theme.spacing(5),
  },
  alert: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
}));

export const useTargetInfo = () => {
  const targetChain = useSelector(selectTransferTargetChain);
  const targetAddressHex = useSelector(selectTransferTargetAddressHex);
  const targetAsset = useSelector(selectTransferTargetAsset);
  const targetParsedTokenAccount = useSelector(
    selectTransferTargetParsedTokenAccount
  );
  const tokenName = targetParsedTokenAccount?.name;
  const symbol = targetParsedTokenAccount?.symbol;
  const logo = targetParsedTokenAccount?.logo;
  const readableTargetAddress =
    hexToNativeString(targetAddressHex, targetChain) || "";
  return useMemo(
    () => ({
      targetChain,
      targetAsset,
      tokenName,
      symbol,
      logo,
      readableTargetAddress,
    }),
    [targetChain, targetAsset, tokenName, symbol, logo, readableTargetAddress]
  );
};

function Target() {
  const { t } = useTranslation();
  useGetTargetParsedTokenAccounts();
  const classes = useStyles();
  const dispatch = useDispatch();
  const sourceChain = useSelector(selectTransferSourceChain);
  const chains = useMemo(
    () => CHAINS.filter((c) => c.id !== sourceChain),
    [sourceChain]
  );
  const { error: targetAssetError, data } = useSelector(
    selectTransferTargetAssetWrapper
  );
  const {
    targetChain,
    targetAsset,
    tokenName,
    symbol,
    logo,
    readableTargetAddress,
  } = useTargetInfo();
  const { isFetching: isFetchingSourceAssetInfo, error: fetchSourceAssetInfoError } = useSelector(selectTransferSourceAssetInfoWrapper);
  const uiAmountString = useSelector(selectTransferTargetBalanceString);
  const transferAmount = useSelector(selectTransferAmount);
  const error = useSelector(selectTransferTargetError);
  const isTargetComplete = useSelector(selectTransferIsTargetComplete);
  const shouldLockFields = useSelector(selectTransferShouldLockFields);
  const { statusMessage } = useIsWalletReady(targetChain);
  const isLoading = (!statusMessage && !targetAssetError && !data && !fetchSourceAssetInfoError) || isFetchingSourceAssetInfo;
  const { associatedAccountExists, setAssociatedAccountExists } =
    useAssociatedAccountExistsState(
      targetChain,
      targetAsset,
      readableTargetAddress
    );
  useSyncTargetAddress(!shouldLockFields);
  const handleTargetChange = useCallback(
    (event: any) => {
      dispatch(setTargetChain(event.target.value));
    },
    [dispatch]
  );
  const handleNextClick = useCallback(() => {
    dispatch(incrementStep());
  }, [dispatch]);
  return (
    <>
      <StepDescription>{t("Select a recipient chain and address.")}</StepDescription>
      <ChainSelect
        variant="outlined"
        select
        fullWidth
        value={targetChain}
        onChange={handleTargetChange}
        disabled={true}
        chains={chains}
      />
      <KeyAndBalance chainId={targetChain} />
      {readableTargetAddress ? (
        <>
          {targetAsset ? (
            <div className={classes.transferField}>
              <Typography variant="subtitle2">{t("Bridged tokens")}:</Typography>
              <Typography component="div">
                <SmartAddress
                  chainId={targetChain}
                  address={targetAsset}
                  symbol={symbol}
                  tokenName={tokenName}
                  logo={logo}
                  variant="h6"
                  isAsset
                />
                {`(${t('Amount')}: ${transferAmount})`}
              </Typography>
            </div>
          ) : null}
          <div className={classes.transferField}>
            <Typography variant="subtitle2">{t('Sent to')}:</Typography>
            <Typography component="div">
              <SmartAddress
                chainId={targetChain}
                address={targetChain === CHAIN_ID_ALEPHIUM ? hexToALPHAddress(readableTargetAddress) : readableTargetAddress}
                variant="h6"
              />
              {t('Current balance')} {uiAmountString || "0"}
            </Typography>
          </div>
        </>
      ) : null}
      {targetChain === CHAIN_ID_SOLANA && targetAsset ? (
        <SolanaCreateAssociatedAddress
          mintAddress={targetAsset}
          readableTargetAddress={readableTargetAddress}
          associatedAccountExists={associatedAccountExists}
          setAssociatedAccountExists={setAssociatedAccountExists}
        />
      ) : null}
      <LowBalanceWarning chainId={targetChain} />
      {targetChain === CHAIN_ID_SOLANA && CLUSTER === "mainnet" && (
        <SolanaTPSWarning />
      )}
      <ButtonWithLoader
        disabled={!isTargetComplete || !associatedAccountExists || isLoading}
        onClick={handleNextClick}
        showLoader={isLoading}
        error={
          statusMessage || fetchSourceAssetInfoError || (isLoading ? undefined : error || targetAssetError)
        }
      >
        {t("Next")}
      </ButtonWithLoader>
      {!statusMessage && data && !data.doesExist ? <RegisterNowButton /> : null}
    </>
  );
}

export default Target;

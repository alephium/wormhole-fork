import { CHAIN_ID_BSC, CHAIN_ID_ETH, CHAIN_ID_SOLANA } from "@alephium/wormhole-sdk";
import { getAddress } from "@ethersproject/address";
import { Button, makeStyles, Typography } from "@material-ui/core";

import { useCallback, useMemo } from "react";

import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router";

import useIsWalletReady from "../../hooks/useIsWalletReady";

import {
  selectTransferAmount,
  selectTransferIsSourceComplete,
  selectTransferShouldLockFields,
  selectTransferSourceBalanceString,
  selectTransferSourceChain,
  selectTransferSourceError,
  selectTransferSourceParsedTokenAccount,
  selectTransferTargetChain,
} from "../../store/selectors";
import { incrementStep, setAmount, setSourceChain, setTargetChain } from "../../store/transferSlice";
import {
  BSC_MIGRATION_ASSET_MAP,
  CHAINS,
  CLUSTER,
  ETH_MIGRATION_ASSET_MAP,
  getIsTransferDisabled,
  MIGRATION_ASSET_MAP,
} from "../../utils/consts";
import LowBalanceWarning from "../LowBalanceWarning";
import SolanaTPSWarning from "../SolanaTPSWarning";
import SourceAssetWarning from "../Transfer/SourceAssetWarning";
import ChainWarningMessage from "../ChainWarningMessage";
import { useTranslation } from "react-i18next";
import { TokenSelector2 } from "./SourceTokenSelector2";
import ChainSelect2 from "../ChainSelect2";
import ChainSelectArrow2 from "./ChainSelectArrow2";
import useSyncTargetAddress from "../../hooks/useSyncTargetAddress";
import useGetTargetParsedTokenAccounts from "../../hooks/useGetTargetParsedTokenAccounts";

const useStyles = makeStyles((theme) => ({
  chainSelectWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
    gap: "5px",
  },
  chainSelectContainer: {
    flexBasis: "100%",
    width: "100%",
  },

  chainSelectArrow: {
    position: "absolute",
    top: "calc(50% - 23px)",
    transform: "rotate(90deg)",
  },
  transferField: {
    marginTop: theme.spacing(5),
  },
}));

function Source2() {
  const { t } = useTranslation();
  const classes = useStyles();
  const dispatch = useDispatch();
  const history = useHistory();
  const sourceChain = useSelector(selectTransferSourceChain);
  const targetChain = useSelector(selectTransferTargetChain);
  const targetChainOptions = useMemo(() => CHAINS.filter((c) => c.id !== sourceChain), [sourceChain]);
  const isSourceTransferDisabled = useMemo(() => {
    return getIsTransferDisabled(sourceChain, true);
  }, [sourceChain]);
  const isTargetTransferDisabled = useMemo(() => {
    return getIsTransferDisabled(targetChain, false);
  }, [targetChain]);
  const parsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount);
  const hasParsedTokenAccount = !!parsedTokenAccount;
  const isSolanaMigration =
    sourceChain === CHAIN_ID_SOLANA && !!parsedTokenAccount && !!MIGRATION_ASSET_MAP.get(parsedTokenAccount.mintKey);
  const isEthereumMigration =
    sourceChain === CHAIN_ID_ETH &&
    !!parsedTokenAccount &&
    !!ETH_MIGRATION_ASSET_MAP.get(getAddress(parsedTokenAccount.mintKey));
  const isBscMigration =
    sourceChain === CHAIN_ID_BSC &&
    !!parsedTokenAccount &&
    !!BSC_MIGRATION_ASSET_MAP.get(getAddress(parsedTokenAccount.mintKey));
  const isMigrationAsset = isSolanaMigration || isEthereumMigration || isBscMigration;
  const uiAmountString = useSelector(selectTransferSourceBalanceString);
  const amount = useSelector(selectTransferAmount);
  const error = useSelector(selectTransferSourceError);
  const isSourceComplete = useSelector(selectTransferIsSourceComplete);
  const shouldLockFields = useSelector(selectTransferShouldLockFields);
  const { isReady, statusMessage } = useIsWalletReady(sourceChain);
  const handleMigrationClick = useCallback(() => {
    if (sourceChain === CHAIN_ID_SOLANA) {
      history.push(`/migrate/Solana/${parsedTokenAccount?.mintKey}/${parsedTokenAccount?.publicKey}`);
    } else if (sourceChain === CHAIN_ID_ETH) {
      history.push(`/migrate/Ethereum/${parsedTokenAccount?.mintKey}`);
    } else if (sourceChain === CHAIN_ID_BSC) {
      history.push(`/migrate/BinanceSmartChain/${parsedTokenAccount?.mintKey}`);
    }
  }, [history, parsedTokenAccount, sourceChain]);
  const handleSourceChange = useCallback(
    (event: any) => {
      dispatch(setSourceChain(event.target.value));
    },
    [dispatch]
  );
  useGetTargetParsedTokenAccounts();
  useSyncTargetAddress(!shouldLockFields);
  const handleTargetChange = useCallback(
    (event: any) => {
      dispatch(setTargetChain(event.target.value));
    },
    [dispatch]
  );

  return (
    <>
      <div className={classes.chainSelectWrapper}>
        <div className={classes.chainSelectContainer}>
          <ChainSelect2
            label="From"
            select
            variant="outlined"
            fullWidth
            value={sourceChain}
            onChange={handleSourceChange}
            disabled={shouldLockFields}
            chains={CHAINS}
          />
        </div>
        <div className={classes.chainSelectArrow}>
          <ChainSelectArrow2
            onClick={() => {
              dispatch(setSourceChain(targetChain));
            }}
            disabled={shouldLockFields}
          />
        </div>
        <div className={classes.chainSelectContainer}>
          <ChainSelect2
            label="To"
            variant="outlined"
            select
            fullWidth
            value={targetChain}
            onChange={handleTargetChange}
            disabled={shouldLockFields}
            chains={targetChainOptions}
          />
        </div>
      </div>

      {isReady || uiAmountString ? <TokenSelector2 disabled={shouldLockFields} /> : null}

      {isMigrationAsset ? (
        <Button variant="contained" color="primary" fullWidth onClick={handleMigrationClick}>
          {t("Go to Migration Page")}
        </Button>
      ) : (
        <>
          <LowBalanceWarning chainId={sourceChain} />
          <SourceAssetWarning sourceChain={sourceChain} sourceAsset={parsedTokenAccount?.mintKey} />
          {/* {hasParsedTokenAccount ? (
            <NumberTextField
              variant="outlined"
              label={t("Amount")}
              fullWidth
              className={classes.transferField}
              value={amount}
              onChange={handleAmountChange}
              disabled={shouldLockFields}
              onMaxClick={uiAmountString && !parsedTokenAccount.isNativeAsset ? handleMaxClick : undefined}
            />
          ) : null} */}
          <ChainWarningMessage chainId={sourceChain} />
          <ChainWarningMessage chainId={targetChain} />
          {/* <ButtonWithLoader
            disabled={!isSourceComplete || isSourceTransferDisabled || isTargetTransferDisabled}
            onClick={handleNextClick}
            showLoader={false}
            error={statusMessage || error}
          >
            {t("Next")}
          </ButtonWithLoader> */}
        </>
      )}
    </>
  );
}

export default Source2;

const Label = ({ children }: { children: React.ReactNode }) => (
  <Typography style={{ fontSize: "14px", color: "rgba(255, 255, 255, 0.5)", marginBottom: "8px" }}>
    {children}
  </Typography>
);

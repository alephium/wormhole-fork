import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_SOLANA,
  ChainId,
  isEVMChain,
} from "@alephium/wormhole-sdk";
import { getAddress } from "@ethersproject/address";
import { Button, makeStyles, Typography, Popover, List, ListItem, ListItemText, IconButton } from "@material-ui/core";
import { VerifiedUser, Close } from "@material-ui/icons";
import { useCallback, useMemo, useState } from "react";
import useGetSourceParsedTokens from "../../hooks/useGetSourceParsedTokenAccounts";
import { useDispatch, useSelector } from "react-redux";
import { useHistory } from "react-router";
import { Link } from "react-router-dom";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import useCopyToClipboard from "../../hooks/useCopyToClipboard";
import { setSourceParsedTokenAccount, setSourceWalletAddress } from "../../store/nftSlice";
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
import {
  incrementStep,
  ParsedTokenAccount,
  setAmount,
  setSourceChain,
  setTargetChain,
} from "../../store/transferSlice";
import {
  BSC_MIGRATION_ASSET_MAP,
  CHAINS,
  CLUSTER,
  ETH_MIGRATION_ASSET_MAP,
  getIsTransferDisabled,
  MIGRATION_ASSET_MAP,
} from "../../utils/consts";
import ButtonWithLoader from "../ButtonWithLoader";
import ChainSelect from "../ChainSelect";
import ChainSelectArrow from "../ChainSelectArrow";
import KeyAndBalance from "../KeyAndBalance";
import LowBalanceWarning from "../LowBalanceWarning";
import NumberTextField from "../NumberTextField";
import SolanaTPSWarning from "../SolanaTPSWarning";
import StepDescription from "../StepDescription";
import { TokenSelector } from "../TokenSelectors/SourceTokenSelector";
import SourceAssetWarning from "./SourceAssetWarning";
import ChainWarningMessage from "../ChainWarningMessage";
import { useTranslation } from "react-i18next";
import { AlephiumConnectButton } from "@alephium/web3-react";
import { useEthereumProvider } from "../../contexts/EthereumProviderContext";
import EvmTokenPicker2 from "../TokenSelectors/EvmTokenPicker2";
import AlephiumTokenPicker2 from "../TokenSelectors/AlephiumTokenPicker2";
import { TokenSelector2 } from "../TokenSelectors/SourceTokenSelector2";
import ChainSelect2 from "../ChainSelect2";

const useStyles = makeStyles((theme) => ({
  chainSelectWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  chainSelectContainer: {
    flexBasis: "100%",
    width: "100%",
  },
  chainSelectLabelRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chainSelectArrow: {
    position: "relative",
    top: "12px",
    transform: "rotate(90deg)",
  },
  transferField: {
    marginTop: theme.spacing(5),
  },
  accountAddress: {
    fontSize: "14px",
    color: "rgba(255, 255, 255, 0.5)",
    marginBottom: "8px",
    fontWeight: 600,
    cursor: "pointer",
    "&:hover": {
      color: "rgba(255, 255, 255, 0.7)",
    },
  },
  modalTitle: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalContent: {
    minWidth: "200px",
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
  const handleTargetChange = useCallback(
    (event: any) => {
      dispatch(setTargetChain(event.target.value));
    },
    [dispatch]
  );
  const handleAmountChange = useCallback(
    (event: any) => {
      dispatch(setAmount(event.target.value));
    },
    [dispatch]
  );
  const handleMaxClick = useCallback(() => {
    if (uiAmountString) {
      dispatch(setAmount(uiAmountString));
    }
  }, [dispatch, uiAmountString]);
  const handleNextClick = useCallback(() => {
    dispatch(incrementStep());
  }, [dispatch]);

  return (
    <>
      <div className={classes.chainSelectWrapper}>
        <div className={classes.chainSelectContainer}>
          <div className={classes.chainSelectLabelRow}>
            <Label>{t("From")}</Label>
            <ConnectedChainAccount chainId={sourceChain} />
          </div>
          <ChainSelect2
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
          <ChainSelectArrow
            onClick={() => {
              dispatch(setSourceChain(targetChain));
            }}
            disabled={shouldLockFields}
          />
        </div>
        <div className={classes.chainSelectContainer}>
          <div className={classes.chainSelectLabelRow}>
            <Label>{t("To")}</Label>
            <ConnectedChainAccount chainId={targetChain} />
          </div>
          <ChainSelect2
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

      {/* <KeyAndBalance chainId={sourceChain} /> */}

      {isReady || uiAmountString ? (
        // <div className={classes.transferField}>
        //   <TokenSelector disabled={shouldLockFields} />
        // </div>
        <TokenSelector2 disabled={shouldLockFields} />
      ) : // <TokenAmountInput disabled={shouldLockFields} />
      null}

      {isMigrationAsset ? (
        <Button variant="contained" color="primary" fullWidth onClick={handleMigrationClick}>
          {t("Go to Migration Page")}
        </Button>
      ) : (
        <>
          <LowBalanceWarning chainId={sourceChain} />
          {sourceChain === CHAIN_ID_SOLANA && CLUSTER === "mainnet" && <SolanaTPSWarning />}
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

const ConnectedChainAccount = ({ chainId }: { chainId: ChainId }) => {
  if (isEVMChain(chainId)) {
    return <CurrentlyConnectedEVMAccount />;
  }

  if (chainId === CHAIN_ID_ALEPHIUM) {
    return (
      <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
        {({ isConnected, show, disconnect, account }) => {
          return (
            // `show` and `hide` will never be undefined. TODO: Fix the types in web3-react
            account?.address && <AccountAddress address={account.address} disconnect={disconnect} />
          );
        }}
      </AlephiumConnectButton.Custom>
    );
  }

  return null;
};

const CurrentlyConnectedEVMAccount = () => {
  const { signerAddress, disconnect } = useEthereumProvider();
  return signerAddress ? <AccountAddress address={signerAddress} disconnect={disconnect} /> : null;
};

const AccountAddress = ({ address, disconnect }: { address: string; disconnect: () => void }) => {
  const classes = useStyles();

  const [open, setOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const copyToClipboard = useCopyToClipboard(address);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setAnchorEl(null);
  };

  const handleCopy = () => {
    copyToClipboard();
    handleClose();
  };

  return (
    <>
      <Typography className={classes.accountAddress} onClick={handleOpen}>
        {address.slice(0, 5) + "..." + address.slice(-5)}
      </Typography>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        classes={{ paper: classes.modalContent }}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
      >
        <List>
          <ListItem button onClick={handleCopy}>
            <ListItemText primary="Copy address" />
          </ListItem>
          <ListItem button onClick={disconnect}>
            <ListItemText primary="Disconnect" />
          </ListItem>
        </List>
      </Popover>
    </>
  );
};

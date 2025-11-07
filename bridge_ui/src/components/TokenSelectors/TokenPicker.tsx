import { ChainId } from "@alephium/wormhole-sdk";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { makeStyles } from '@mui/styles';
import { createStyles } from '@mui/styles';
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Alert } from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NFTParsedTokenAccount } from "../../store/nftSlice";
import { balancePretty } from "../../utils/balancePretty";
import { getIsTokenTransferDisabled } from "../../utils/consts";
import { shortenAddress } from "../../utils/addresses";
import NFTViewer from "./NFTViewer";

const useStyles = makeStyles((theme) =>
  createStyles({
    alignCenter: {
      textAlign: "center",
    },
    optionContainer: {
      padding: 0,
    },
    optionContent: {
      padding: theme.spacing(1),
    },
    tokenList: {
      maxHeight: theme.spacing(80), //TODO smarter
      height: theme.spacing(80),
      overflow: "auto",
    },
    dialogContent: {
      overflowX: "hidden",
    },
    selectionButtonContainer: {
      //display: "flex",
      textAlign: "center",
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(2),
    },
    selectionButton: {
      maxWidth: "100%",
      width: theme.breakpoints.values.sm,
    },
    tokenOverviewContainer: {
      display: "flex",
      width: "100%",
      alignItems: "center",
      "& div": {
        margin: theme.spacing(1),
        flexBasis: "25%",
        "&$tokenImageContainer": {
          maxWidth: 40,
        },
        "&$tokenMarketsList": {
          marginTop: theme.spacing(-0.5),
          marginLeft: 0,
          flexBasis: "100%",
        },
        "&:last-child": {
          textAlign: "right",
        },
        flexShrink: 1,
      },
      flexWrap: "wrap",
    },
    tokenImageContainer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 40,
    },
    tokenImage: {
      maxHeight: "2.5rem", //Eyeballing this based off the text size
    },
    tokenMarketsList: {
      order: 1,
      textAlign: "left",
      width: "100%",
      "& > .MuiButton-root": {
        marginTop: theme.spacing(1),
        marginRight: theme.spacing(1),
      },
    },
    migrationAlert: {
      width: "100%",
      "& .MuiAlert-message": {
        width: "100%",
      },
    },
    flexTitle: {
      display: "flex",
      flexDirection: "row",
      alignItems: "center",
    },
    grower: {
      flexGrow: 1,
    },
  })
);

export const BasicAccountRender = (
  account: MarketParsedTokenAccount,
  isMigrationEligible: (address: string) => boolean,
  nft: boolean,
  displayBalance?: (account: NFTParsedTokenAccount) => boolean
) => {
  const { t } = useTranslation();
  const classes = useStyles();
  const mintPrettyString = shortenAddress(account.mintKey);
  const uri = nft ? account.image_256 : account.logo || account.uri;
  const symbol = account.symbol || t("Unknown");
  const name = account.name || t("Unknown");
  const tokenId = account.tokenId;
  const shouldDisplayBalance = !displayBalance || displayBalance(account);

  const nftContent = (
    <div className={classes.tokenOverviewContainer}>
      <div className={classes.tokenImageContainer}>
        {uri && <img alt="" className={classes.tokenImage} src={uri} />}
      </div>
      <div>
        <Typography>{symbol}</Typography>
        <Typography>{name}</Typography>
      </div>
      <div>
        <Typography>{mintPrettyString}</Typography>
        <Typography style={{ wordBreak: "break-all" }}>{tokenId}</Typography>
      </div>
    </div>
  );

  const tokenContent = (
    <div className={classes.tokenOverviewContainer}>
      <div className={classes.tokenImageContainer}>
        {uri && <img alt="" className={classes.tokenImage} src={uri} />}
      </div>
      <div>
        <Typography variant="subtitle1">{symbol}</Typography>
      </div>
      <div>
        {
          <Typography variant="body1">
            {account.isNativeAsset ? "Native" : mintPrettyString}
          </Typography>
        }
      </div>
      <div>
        {shouldDisplayBalance ? (
          <>
            <Typography variant="body2">{"Balance"}</Typography>
            <Typography variant="h6">
              {balancePretty(account.uiAmountString)}
            </Typography>
          </>
        ) : (
          <div />
        )}
      </div>
    </div>
  );

  const migrationRender = (
    <div className={classes.migrationAlert}>
      <Alert severity="warning">
        <Typography variant="body2">
          {t("This is a legacy asset eligible for migration.")}
        </Typography>
        <div>{tokenContent}</div>
      </Alert>
    </div>
  );

  return nft
    ? nftContent
    : isMigrationEligible(account.mintKey)
    ? migrationRender
    : tokenContent;
};

interface MarketParsedTokenAccount extends NFTParsedTokenAccount {
  markets?: string[];
}

export default function TokenPicker({
  value,
  options,
  RenderOption,
  onChange,
  isValidAddress,
  getAddress,
  disabled,
  resetAccounts,
  nft,
  chainId,
  error,
  showLoader,
  useTokenId,
}: {
  value: NFTParsedTokenAccount | null;
  options: NFTParsedTokenAccount[];
  RenderOption: ({
    account,
  }: {
    account: NFTParsedTokenAccount;
  }) => JSX.Element;
  onChange: (newValue: NFTParsedTokenAccount | null) => Promise<void>;
  isValidAddress?: (address: string) => boolean;
  getAddress?: (
    address: string,
    tokenId?: string
  ) => Promise<NFTParsedTokenAccount>;
  disabled: boolean;
  resetAccounts: (() => void) | undefined;
  nft: boolean;
  chainId: ChainId;
  error?: string;
  showLoader?: boolean;
  useTokenId?: boolean;
}) {
  const { t } = useTranslation();
  const classes = useStyles();
  const [holderString, setHolderString] = useState("");
  const [tokenIdHolderString, setTokenIdHolderString] = useState("");
  const [loadingError, setLoadingError] = useState("");
  const [isLocalLoading, setLocalLoading] = useState(false);
  const [dialogIsOpen, setDialogIsOpen] = useState(false);
  const [selectionError, setSelectionError] = useState("");

  const openDialog = useCallback(() => {
    setHolderString("");
    setSelectionError("");
    setDialogIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogIsOpen(false);
  }, []);

  const handleSelectOption = useCallback(
    async (option: NFTParsedTokenAccount) => {
      setSelectionError("");
      let newOption = null;
      try {
        //Covalent balances tend to be stale, so we make an attempt to correct it at selection time.
        if (getAddress && !option.isNativeAsset) {
          newOption = await getAddress(option.mintKey, option.tokenId);
          newOption = {
            ...option,
            ...newOption,
            // keep logo and uri from covalent / market list / etc (otherwise would be overwritten by undefined)
            logo: option.logo || newOption.logo,
            uri: option.uri || newOption.uri,
          } as NFTParsedTokenAccount;
        } else {
          newOption = option;
        }
        await onChange(newOption);
        closeDialog();
      } catch (e: any) {
        if (e.message?.includes("v1")) {
          setSelectionError(e.message);
        } else {
          setSelectionError(
            t("Unable to retrieve required information about this token. Ensure your wallet is connected, then refresh the list.")
          );
        }
      }
    },
    [getAddress, onChange, closeDialog, t]
  );

  const resetAccountsWrapper = useCallback(() => {
    setHolderString("");
    setTokenIdHolderString("");
    setSelectionError("");
    resetAccounts && resetAccounts();
  }, [resetAccounts]);

  const searchFilter = useCallback(
    (option: NFTParsedTokenAccount) => {
      if (!holderString) {
        return true;
      }
      const optionString = (
        (option.publicKey || "") +
        " " +
        (option.mintKey || "") +
        " " +
        (option.symbol || "") +
        " " +
        (option.name || " ")
      ).toLowerCase();
      const searchString = holderString.toLowerCase();
      return optionString.includes(searchString);
    },
    [holderString]
  );

  const nonFeaturedOptions = useMemo(() => {
    return options.filter(
      (option: NFTParsedTokenAccount) => searchFilter(option)
    );
  }, [options, searchFilter]);

  const localFind = useCallback(
    (address: string, tokenIdHolderString: string) => {
      return options.find(
        (x) =>
          x.mintKey.toLowerCase() === address.toLowerCase() &&
          (!tokenIdHolderString || x.tokenId === tokenIdHolderString)
      );
    },
    [options]
  );

  //This is the effect which allows pasting an address in directly
  useEffect(() => {
    if (!isValidAddress || !getAddress) {
      return;
    }
    if (useTokenId && !tokenIdHolderString) {
      return;
    }
    setLoadingError("");
    let cancelled = false;
    if (isValidAddress(holderString)) {
      const option = localFind(holderString, tokenIdHolderString);
      if (option) {
        handleSelectOption(option);
        return () => {
          cancelled = true;
        };
      }
      setLocalLoading(true);
      setLoadingError("");
      getAddress(
        holderString,
        useTokenId ? tokenIdHolderString : undefined
      ).then(
        (result) => {
          if (!cancelled) {
            setLocalLoading(false);
            if (result) {
              handleSelectOption(result);
            }
          }
        },
        (error) => {
          if (!cancelled) {
            setLocalLoading(false);
            setLoadingError(t("Could not find the specified address."));
          }
        }
      );
    }
    return () => (cancelled = true);
  }, [
    holderString,
    isValidAddress,
    getAddress,
    handleSelectOption,
    localFind,
    tokenIdHolderString,
    useTokenId,
    t
  ]);

  //TODO reset button
  //TODO debounce & save hotloaded options as an option before automatically selecting
  //TODO sigfigs function on the balance strings

  const localLoader = (
    <div className={classes.alignCenter}>
      <CircularProgress />
      <Typography variant="body2">
        {showLoader ? t("Loading available tokens") : t("Searching for results")}
      </Typography>
    </div>
  );

  const displayLocalError = (
    <div className={classes.alignCenter}>
      <Typography variant="body2" color="error">
        {loadingError || selectionError}
      </Typography>
    </div>
  );

  const dialog = (
    <Dialog
      onClose={closeDialog}
      aria-labelledby="simple-dialog-title"
      open={dialogIsOpen}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <div id="simple-dialog-title" className={classes.flexTitle}>
          <Typography variant="h5">{t("Select a token")}</Typography>
          <div className={classes.grower} />
          <Tooltip title="Reload tokens">
            <IconButton onClick={resetAccountsWrapper} size="large">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </div>
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>
        <TextField
          variant="outlined"
          label={t("Search name or paste address")}
          value={holderString}
          onChange={(event) => setHolderString(event.target.value)}
          fullWidth
          margin="normal"
        />
        {useTokenId ? (
          <TextField
            variant="outlined"
            label={t("Token ID")}
            value={tokenIdHolderString}
            onChange={(event) => setTokenIdHolderString(event.target.value)}
            fullWidth
            margin="normal"
          />
        ) : null}
        {isLocalLoading || showLoader ? (
          localLoader
        ) : loadingError || selectionError ? (
          displayLocalError
        ) : (
          <List component="div" className={classes.tokenList}>
            {nonFeaturedOptions.map((option) => {
              return (
                <ListItemButton
                  component="div"
                  onClick={() => handleSelectOption(option)}
                  key={
                    option.publicKey + option.mintKey + (option.tokenId || "")
                  }
                  disabled={getIsTokenTransferDisabled(chainId, option.mintKey)}
                >
                  <RenderOption account={option} />
                </ListItemButton>
              );
            })}
            {nonFeaturedOptions.length ? null : (
              <div className={classes.alignCenter}>
                <Typography>{t("No results found")}</Typography>
              </div>
            )}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );

  const selectionChip = (
    <div className={classes.selectionButtonContainer}>
      <Button
        onClick={openDialog}
        disabled={disabled}
        variant="outlined"
        startIcon={<KeyboardArrowDownIcon />}
        className={classes.selectionButton}
      >
        {value ? (
          <RenderOption account={value} />
        ) : (
          <Typography color="textSecondary">{t("Select a token")}</Typography>
        )}
      </Button>
    </div>
  );

  return (
    <>
      {dialog}
      {value && nft ? <NFTViewer value={value} chainId={chainId} /> : null}
      {selectionChip}
    </>
  );
}

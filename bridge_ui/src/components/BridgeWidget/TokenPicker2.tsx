import { ChainId } from "@alephium/wormhole-sdk";
import {
  Button,
  CircularProgress,
  createStyles,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  makeStyles,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import KeyboardArrowDownIcon from "@material-ui/icons/KeyboardArrowDown";
import RefreshIcon from "@material-ui/icons/Refresh";
import { Alert } from "@material-ui/lab";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { NFTParsedTokenAccount } from "../../store/nftSlice";
import { balancePretty } from "../../utils/balancePretty";
import { getIsTokenTransferDisabled } from "../../utils/consts";
import { shortenAddress } from "../../utils/solana";
import NFTViewer from "../TokenSelectors/NFTViewer";
import { useDispatch, useSelector } from "react-redux";
import { selectTransferAmount, selectTransferSourceError } from "../../store/selectors";
import { setAmount } from "../../store/transferSlice";
import SmartAddress from "../SmartAddress";
import { useTargetInfo } from "../Transfer/Target";

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
    tokenImageContainer2: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 20,
    },
    tokenIconSymbolContainer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "5px",
    },
    tokenImage: {
      maxHeight: "2.5rem",
    },
    tokenImage2: {
      maxHeight: "1rem",
      maxWidth: "100%",
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

    tokenAmountInputContainer: {
      display: "flex",
      flexDirection: "column",
      gap: "5px",
      padding: "14px",
      backgroundColor: "rgba(255, 255, 255, 0.05)",
      borderRadius: "20px",
      marginTop: "10px",
    },
    tokenAmountControls: {
      display: "flex",
      gap: "10px",
      justifyContent: "space-between",
    },
    tokenAvailableMaxContainer: {
      display: "flex",
      gap: "10px",
      alignItems: "center",
    },
    tokenAvailableBalance: {
      fontSize: "0.875rem",
      color: "rgba(255, 255, 255, 0.5)",
      padding: "8px 12px",
      border: "none",
      backgroundColor: "transparent",
      borderRadius: "20px",
      cursor: "pointer",
      "&:hover": {
        backgroundColor: "rgba(255, 255, 255, 0.1)",
      },
    },
    useMaxButton: {
      fontSize: "0.875rem",
    },
    tokenAmountInput: {
      display: "flex",
      gap: "10px",
      alignItems: "center",
    },
    tokenAmountValue: {
      display: "flex",
      alignItems: "center",
      gap: "10px",
    },
    tokenAmountValueInput: {
      marginLeft: "0.125rem",
      display: "block",
      width: "100%",
      boxShadow: "none",
      backgroundColor: "transparent",
      fontSize: "2.25rem",
      lineHeight: 1,
      border: "none",
      outline: "none",
      "&:focus": {
        outline: "none",
      },
      "&:hover": {
        outline: "none",
      },
      color: "#fff",
      fontFeatureSettings: "tnum",
    },
    tokenPicker: {
      flexGrow: 1,
      backgroundColor: "rgba(255,255,255,.06)",
      padding: "8px 12px",
      borderRadius: "20px",
      border: "none",
      color: "#fff",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "5px",
      cursor: "pointer",
      "&:hover": {
        backgroundColor: "rgba(255, 255, 255, 0.1)",
      },
    },
  })
);

export const BasicAccountRender2 = (
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
      <div>{<Typography variant="body1">{account.isNativeAsset ? "Native" : mintPrettyString}</Typography>}</div>
      <div>
        {shouldDisplayBalance ? (
          <>
            <Typography variant="body2">{"Balance"}</Typography>
            <Typography variant="h6">{balancePretty(account.uiAmountString)}</Typography>
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
        <Typography variant="body2">{t("This is a legacy asset eligible for migration.")}</Typography>
        <div>{tokenContent}</div>
      </Alert>
    </div>
  );

  return nft ? nftContent : isMigrationEligible(account.mintKey) ? migrationRender : tokenContent;
};

interface MarketParsedTokenAccount extends NFTParsedTokenAccount {
  markets?: string[];
}

export default function TokenPicker2({
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
  showLoader,
  useTokenId,
}: {
  value: NFTParsedTokenAccount | null;
  options: NFTParsedTokenAccount[];
  RenderOption: ({ account }: { account: NFTParsedTokenAccount }) => JSX.Element;
  onChange: (newValue: NFTParsedTokenAccount | null) => Promise<void>;
  isValidAddress?: (address: string) => boolean;
  getAddress?: (address: string, tokenId?: string) => Promise<NFTParsedTokenAccount>;
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
  const error = useSelector(selectTransferSourceError);

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
            t(
              "Unable to retrieve required information about this token. Ensure your wallet is connected, then refresh the list."
            )
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
    return options.filter((option: NFTParsedTokenAccount) => searchFilter(option));
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
      getAddress(holderString, useTokenId ? tokenIdHolderString : undefined).then(
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
  }, [holderString, isValidAddress, getAddress, handleSelectOption, localFind, tokenIdHolderString, useTokenId, t]);

  //TODO reset button
  //TODO debounce & save hotloaded options as an option before automatically selecting
  //TODO sigfigs function on the balance strings

  const localLoader = (
    <div className={classes.alignCenter}>
      <CircularProgress />
      <Typography variant="body2">{showLoader ? t("Loading available tokens") : t("Searching for results")}</Typography>
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
    <Dialog onClose={closeDialog} aria-labelledby="simple-dialog-title" open={dialogIsOpen} maxWidth="sm" fullWidth>
      <DialogTitle>
        <div id="simple-dialog-title" className={classes.flexTitle}>
          <Typography variant="h5">{t("Select a token")}</Typography>
          <div className={classes.grower} />
          <Tooltip title="Reload tokens">
            <IconButton onClick={resetAccountsWrapper}>
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
                <ListItem
                  component="div"
                  button
                  onClick={() => handleSelectOption(option)}
                  key={option.publicKey + option.mintKey + (option.tokenId || "")}
                  disabled={getIsTokenTransferDisabled(chainId, option.mintKey)}
                >
                  <RenderOption account={option} />
                </ListItem>
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

  const amount = useSelector(selectTransferAmount);
  const dispatch = useDispatch();
  const hasError = amount && parseFloat(amount) > 0 && error;

  return (
    <>
      {dialog}

      <div className={classes.tokenAmountInputContainer}>
        <div className={classes.tokenAmountInput}>
          <input
            className={classes.tokenAmountValueInput}
            inputMode="decimal"
            minLength={1}
            maxLength={79}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            pattern="^[0-9]*[.,]?[0-9]*$"
            id="amount"
            placeholder="0"
            type="text"
            value={amount}
            name="amount"
            onChange={(event) => dispatch(setAmount(event.target.value))}
            style={{ color: hasError ? "#ed4a34" : "white" }}
          />

          <button className={classes.tokenPicker} onClick={openDialog}>
            {value ? (
              <TokenIconSymbol account={value} />
            ) : (
              <>
                Select <KeyboardArrowDownIcon />
              </>
            )}
          </button>
        </div>
        <div className={classes.tokenAmountControls}>
          <div></div>
          <div className={classes.tokenAvailableMaxContainer}>
            {value?.uiAmountString && (
              <button
                onClick={() => dispatch(setAmount(value?.uiAmountString))}
                className={classes.tokenAvailableBalance}
              >
                max: {balancePretty(value?.uiAmountString)}
              </button>
            )}
          </div>
        </div>

        {hasError && <div style={{ color: "#ed4a34" }}>{error}</div>}
      </div>
    </>
  );
}

const TokenIconSymbol = ({ account }: { account: NFTParsedTokenAccount }) => {
  const { t } = useTranslation();
  const classes = useStyles();
  const uri = account.logo || account.uri;
  const symbol = account.symbol || t("Unknown");

  return (
    <div className={classes.tokenIconSymbolContainer}>
      <div className={classes.tokenImageContainer2}>
        {uri && <img alt="" className={classes.tokenImage2} src={uri} />}
      </div>
      <div>
        <Typography style={{ fontWeight: "bold" }}>{symbol}</Typography>
      </div>
      <KeyboardArrowDownIcon />
    </div>
  );
};

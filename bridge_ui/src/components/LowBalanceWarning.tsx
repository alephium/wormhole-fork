import { ChainId, CHAIN_ID_TERRA } from "@alephium/wormhole-sdk";
import { Typography } from "@mui/material";
import { makeStyles } from '@mui/styles';
import { Alert } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import useIsWalletReady from "../hooks/useIsWalletReady";
import useTransactionFees from "../hooks/useTransactionFees";
import { selectTransferUseRelayer } from "../store/selectors";
import { getDefaultNativeCurrencySymbol } from "../utils/consts";

const useStyles = makeStyles((theme) => ({
  alert: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
}));

function LowBalanceWarning({ chainId }: { chainId: ChainId }) {
  const { t } = useTranslation();
  const classes = useStyles();
  const { isReady } = useIsWalletReady(chainId);
  const transactionFeeWarning = useTransactionFees(chainId);
  const relayerSelected = !!useSelector(selectTransferUseRelayer);

  const displayWarning =
    isReady &&
    !relayerSelected &&
    (chainId === CHAIN_ID_TERRA || transactionFeeWarning.balanceString) &&
    transactionFeeWarning.isSufficientBalance === false;

  const warningMessage =
    chainId === CHAIN_ID_TERRA
      ? t("This wallet may not have sufficient funds to pay for the upcoming transaction fees.")
      : t("This wallet has a very low {{ token }} balance and may not be able to pay for the upcoming transaction fees.", { token: getDefaultNativeCurrencySymbol(chainId)});

  const content = (
    <Alert severity="warning" className={classes.alert}>
      <Typography variant="body1">{warningMessage}</Typography>
      {chainId !== CHAIN_ID_TERRA ? (
        <Typography variant="body1">
          {"Current balance: " + transactionFeeWarning.balanceString}
        </Typography>
      ) : null}
    </Alert>
  );

  return displayWarning ? content : null;
}

export default LowBalanceWarning;

import { CHAIN_ID_SOLANA } from "@alephium/wormhole-sdk";
import { Typography } from "@mui/material";
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  selectAttestAttestTx,
  selectAttestCreateTx,
  selectAttestIsCreating,
  selectAttestIsSending,
  selectAttestIsWalletApproved,
  selectAttestTargetChain,
} from "../../store/selectors";
import { WAITING_FOR_TX_CONFIRMATION, WAITING_FOR_WALLET_APPROVAL } from "../Transfer/WaitingForWalletMessage";

const useStyles = makeStyles()((theme) => ({
  message: {
    color: theme.palette.warning.light,
    marginTop: theme.spacing(1),
    textAlign: "center",
  },
}));

const WaitingForWalletMessage = () => {
  const { t } = useTranslation();
  const { classes } = useStyles();
  const isSending = useSelector(selectAttestIsSending);
  const isWalletApproved = useSelector(selectAttestIsWalletApproved)
  const attestTx = useSelector(selectAttestAttestTx);
  const targetChain = useSelector(selectAttestTargetChain);
  const isCreating = useSelector(selectAttestIsCreating);
  const createTx = useSelector(selectAttestCreateTx);
  const showWarning = (isSending && !attestTx) || (isCreating && !createTx);
  return showWarning ? (
    <Typography className={classes.message} variant="body2">
      {isWalletApproved ? WAITING_FOR_TX_CONFIRMATION : WAITING_FOR_WALLET_APPROVAL}{" "}
      {targetChain === CHAIN_ID_SOLANA && isCreating
        ? t("Note: there will be several transactions")
        : null}
    </Typography>
  ) : null;
};

export default WaitingForWalletMessage

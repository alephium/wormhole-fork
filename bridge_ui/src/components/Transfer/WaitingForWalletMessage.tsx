import { CHAIN_ID_SOLANA } from "alephium-wormhole-sdk";
import { makeStyles, Typography } from "@material-ui/core";
import { useSelector } from "react-redux";
import {
  selectTransferIsApproving,
  selectTransferIsRedeeming,
  selectTransferIsSending,
  selectTransferIsWalletApproved,
  selectTransferRedeemTx,
  selectTransferTargetChain,
  selectTransferTransferTx,
} from "../../store/selectors";

const useStyles = makeStyles((theme) => ({
  message: {
    color: theme.palette.warning.light,
    marginTop: theme.spacing(1),
    textAlign: "center",
  },
}));

export const WAITING_FOR_WALLET_APPROVAL =
  'Waiting for wallet approval...'

export const WAITING_FOR_TX_CONFIRMATION =
  'Waiting for transaction confirmation...'

export default function WaitingForWalletMessage() {
  const classes = useStyles();
  const isApproving = useSelector(selectTransferIsApproving);
  const isSending = useSelector(selectTransferIsSending);
  const isWalletApproved = useSelector(selectTransferIsWalletApproved)
  const transferTx = useSelector(selectTransferTransferTx);
  const targetChain = useSelector(selectTransferTargetChain);
  const isRedeeming = useSelector(selectTransferIsRedeeming);
  const redeemTx = useSelector(selectTransferRedeemTx);
  const showWarning =
    isApproving || (isSending && !transferTx) || (isRedeeming && !redeemTx);
  return showWarning ? (
    <Typography className={classes.message} variant="body2">
      {isWalletApproved ? WAITING_FOR_TX_CONFIRMATION : WAITING_FOR_WALLET_APPROVAL}{" "}
      {targetChain === CHAIN_ID_SOLANA && isRedeeming
        ? "Note: there will be several transactions"
        : null}
    </Typography>
  ) : null;
}

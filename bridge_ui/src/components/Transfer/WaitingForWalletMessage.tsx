import { CHAIN_ID_SOLANA } from "@alephium/wormhole-sdk";
import { makeStyles, Typography } from "@material-ui/core";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  selectTransferIsApproving,
  selectTransferIsRedeeming,
  selectTransferIsRedeemingViaRelayer,
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
  'Waiting for wallet approval'

export const WAITING_FOR_TX_CONFIRMATION =
  'Waiting for transaction confirmation'

export default function WaitingForWalletMessage() {
  const { t } = useTranslation();
  const classes = useStyles();
  const isApproving = useSelector(selectTransferIsApproving);
  const isSending = useSelector(selectTransferIsSending);
  const isWalletApproved = useSelector(selectTransferIsWalletApproved)
  const transferTx = useSelector(selectTransferTransferTx);
  const targetChain = useSelector(selectTransferTargetChain);
  const isRedeeming = useSelector(selectTransferIsRedeeming);
  const isRedeemingViaRelayer = useSelector(selectTransferIsRedeemingViaRelayer);
  const redeemTx = useSelector(selectTransferRedeemTx);
  const showNote =
    isApproving || (isSending && !transferTx) || (isRedeeming && !redeemTx);
  return isRedeemingViaRelayer
    ? (<Typography className={classes.message} variant="body2">Trying to redeem via relayer...</Typography>)
    : showNote
    ? (<Typography className={classes.message} variant="body2">
        {isWalletApproved ? t(WAITING_FOR_TX_CONFIRMATION) : t(WAITING_FOR_WALLET_APPROVAL)}{"... "}
        {targetChain === CHAIN_ID_SOLANA && isRedeeming
          ? t('Note: there will be several transactions')
          : null}
       </Typography>)
    : null;
}

import { makeStyles, Typography } from "@mui/material";
import { CHAIN_ID_ALEPHIUM, isEVMChain } from "@alephium/wormhole-sdk";
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectTransferIsRedeemedViaRelayer,
  selectTransferRedeemTx,
  selectTransferTargetChain,
} from "../../store/selectors";
import { reset } from "../../store/transferSlice";
import ButtonWithLoader from "../ButtonWithLoader";
import ShowTx from "../ShowTx";
import AddToAlephium from "./AddToAlephium";
import AddToMetamask from "./AddToMetamask";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles((theme) => ({
  description: {
    textAlign: "center",
    marginBottom: theme.spacing(2),
  },
}));

export default function RedeemPreview({
  overrideExplainerString,
}: {
  overrideExplainerString?: string;
}) {
  const { t } = useTranslation();
  const classes = useStyles();
  const dispatch = useDispatch();
  const targetChain = useSelector(selectTransferTargetChain);
  const redeemTx = useSelector(selectTransferRedeemTx);
  const isRedeemedViaRelayer = useSelector(selectTransferIsRedeemedViaRelayer);
  const handleResetClick = useCallback(() => {
    dispatch(reset());
  }, [dispatch]);

  const explainerString = overrideExplainerString ||
    `${t('Success!')} ${isRedeemedViaRelayer ? t('The redeem transaction was submitted automatically by the relayer') : t('The redeem transaction was submitted')}. ${t('The tokens will become available once the transaction confirms.')}`;

  return (
    <>
      <Typography
        component="div"
        variant="subtitle1"
        className={classes.description}
      >
        {explainerString}
      </Typography>
      {redeemTx ? <ShowTx chainId={targetChain} tx={redeemTx} /> : null}
      {targetChain === CHAIN_ID_ALEPHIUM ? <AddToAlephium /> : null}
      {isEVMChain(targetChain) ? <AddToMetamask /> : null}
      <ButtonWithLoader onClick={handleResetClick}>
        {t("Transfer More Tokens!")}
      </ButtonWithLoader>
    </>
  );
}

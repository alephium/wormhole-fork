import { Link, makeStyles, Typography } from "@material-ui/core";
import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  selectAttestCreateTx,
  selectAttestTargetChain,
} from "../../store/selectors";
import { reset } from "../../store/attestSlice";
import ShowTx from "../ShowTx";
import { useHistory } from "react-router";
import { getHowToAddToTokenListUrl } from "../../utils/consts";
import { Alert } from "@material-ui/lab";
import { Trans, useTranslation } from "react-i18next";
import BridgeWidgetButton from "../BridgeWidget/BridgeWidgetButton";

const useStyles = makeStyles((theme) => ({
  description: {
    textAlign: "center",
  },
  alert: {
    marginTop: theme.spacing(1),
  },
  actionButton: {
    marginTop: theme.spacing(2),
  },
}));

export default function CreatePreview() {
  const { t } = useTranslation();
  const { push } = useHistory();
  const classes = useStyles();
  const dispatch = useDispatch();
  const targetChain = useSelector(selectAttestTargetChain);
  const createTx = useSelector(selectAttestCreateTx);
  const handleResetClick = useCallback(() => {
    dispatch(reset());
  }, [dispatch]);
  const handleReturnClick = useCallback(() => {
    dispatch(reset());
    push("/transfer");
  }, [dispatch, push]);

  const explainerString =
    `${t('Success!')} ${t("The create wrapped transaction was submitted.")}`;
  const howToAddToTokenListUrl = getHowToAddToTokenListUrl(targetChain);

  return (
    <>
      <Typography
        component="div"
        variant="subtitle2"
        className={classes.description}
      >
        {explainerString}
      </Typography>
      {createTx ? <ShowTx chainId={targetChain} tx={createTx} /> : null}
      {howToAddToTokenListUrl ? (
        <Alert severity="info" variant="outlined" className={classes.alert}>
          <Trans
            t={t}
            i18nKey="addTokenToTokenList"
            components={{
              1: <Link href={howToAddToTokenListUrl} target="_blank" rel="noopener noreferrer" />
            }}
          >
            {'Remember to add the token to the <1>token list</1>.'}
          </Trans>
        </Alert>
      ) : null}
      <BridgeWidgetButton short className={classes.actionButton} onClick={handleResetClick}>
        {t("Attest Another Token!")}
      </BridgeWidgetButton>
      <BridgeWidgetButton short className={classes.actionButton} onClick={handleReturnClick}>
        {t("Return to Transfer")}
      </BridgeWidgetButton>
    </>
  );
}

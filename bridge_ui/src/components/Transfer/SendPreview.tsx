import { makeStyles, Typography } from "@material-ui/core";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  selectTransferSourceChain,
  selectTransferTransferTx,
} from "../../store/selectors";
import ShowTx from "../ShowTx";

const useStyles = makeStyles((theme) => ({
  description: {
    textAlign: "center",
  },
  tx: {
    marginTop: theme.spacing(1),
    textAlign: "center",
  },
  viewButton: {
    marginTop: theme.spacing(1),
  },
}));

export default function SendPreview() {
  const { t } = useTranslation();
  const classes = useStyles();
  const sourceChain = useSelector(selectTransferSourceChain);
  const transferTx = useSelector(selectTransferTransferTx);

  const explainerString = t("The tokens have entered the bridge!");

  return (
    <>
      <Typography
        component="div"
        variant="subtitle2"
        className={classes.description}
      >
        {explainerString}
      </Typography>
      {transferTx ? <ShowTx chainId={sourceChain} tx={transferTx} /> : null}
    </>
  );
}

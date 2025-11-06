import { Typography } from "@mui/material";
import { makeStyles } from '@mui/styles';
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  selectAttestSourceChain,
  selectAttestAttestTx,
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
  const sourceChain = useSelector(selectAttestSourceChain);
  const attestTx = useSelector(selectAttestAttestTx);

  const explainerString = t("The token has been attested!");

  return (
    <>
      <Typography
        component="div"
        variant="subtitle2"
        className={classes.description}
      >
        {explainerString}
      </Typography>
      {attestTx ? <ShowTx chainId={sourceChain} tx={attestTx} /> : null}
    </>
  );
}

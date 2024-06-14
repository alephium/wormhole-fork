import { makeStyles, Typography } from "@material-ui/core";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  selectAttestSourceAsset,
  selectAttestSourceChain,
} from "../../store/selectors";
import { CHAINS_BY_ID } from "../../utils/consts";
import SmartAddress from "../SmartAddress";

const useStyles = makeStyles((theme) => ({
  description: {
    textAlign: "center",
  },
}));

export default function SourcePreview() {
  const { t } = useTranslation();
  const classes = useStyles();
  const sourceChain = useSelector(selectAttestSourceChain);
  const sourceAsset = useSelector(selectAttestSourceAsset);

  const explainerContent =
    sourceChain && sourceAsset ? (
      <>
        <span>{t("You will attest")}</span>
        <SmartAddress chainId={sourceChain} address={sourceAsset} isAsset />
        <span>{t("on {{ chainName }}", { chainName: CHAINS_BY_ID[sourceChain].name })}</span>
      </>
    ) : (
      ""
    );

  return (
    <Typography
      component="div"
      variant="subtitle2"
      className={classes.description}
    >
      {explainerContent}
    </Typography>
  );
}

import { Typography } from "@mui/material";
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { selectAttestTargetChain } from "../../store/selectors";
import { CHAINS_BY_ID } from "../../utils/consts";

const useStyles = makeStyles()((theme) => ({
  description: {
    textAlign: "center",
  },
}));

export default function TargetPreview() {
  const { t } = useTranslation();
  const { classes } = useStyles();
  const targetChain = useSelector(selectAttestTargetChain);

  const explainerString = t('to {{ chainName }}', { chainName: CHAINS_BY_ID[targetChain].name } );

  return (
    <Typography
      component="div"
      variant="subtitle2"
      className={classes.description}
    >
      {explainerString}
    </Typography>
  );
}

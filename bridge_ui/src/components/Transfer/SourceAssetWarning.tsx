import { ChainId, CHAIN_ID_POLYGON, isEVMChain } from "@alephium/wormhole-sdk";
import { makeStyles, Typography } from "@material-ui/core";
import { Alert } from "@material-ui/lab";
import { useTranslation } from "react-i18next";
import { POLYGON_TERRA_WRAPPED_TOKENS } from "../../utils/consts";

const useStyles = makeStyles((theme) => ({
  container: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  alert: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
}));

function PolygonTerraWrappedWarning() {
  const { t } = useTranslation();
  const classes = useStyles();
  return (
    <Alert severity="warning" variant="outlined" className={classes.alert}>
      <Typography variant="body1">
        {t('This is a Shuttle-wrapped asset from Polygon! Transferring it will result in a double wrapped (Bridge-wrapped Shuttle-wrapped) asset, which has no liquid markets.')}
      </Typography>
    </Alert>
  );
}

export default function SoureAssetWarning({
  sourceChain,
  sourceAsset,
}: {
  sourceChain?: ChainId;
  sourceAsset?: string;
  originChain?: ChainId;
  targetChain?: ChainId;
  targetAsset?: string;
}) {
  if (!(sourceChain && sourceAsset)) {
    return null;
  }

  const searchableAddress = isEVMChain(sourceChain)
    ? sourceAsset.toLowerCase()
    : sourceAsset;
  const showPolygonTerraWrappedWarning =
    sourceChain === CHAIN_ID_POLYGON &&
    POLYGON_TERRA_WRAPPED_TOKENS.includes(searchableAddress);

  return (
    <>
      {showPolygonTerraWrappedWarning ? <PolygonTerraWrappedWarning /> : null}
    </>
  );
}

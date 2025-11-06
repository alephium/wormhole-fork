import { ChainId } from "@alephium/wormhole-sdk";
import { Link, Typography } from "@mui/material";
import { Alert } from "@mui/material";
import { useMemo } from "react";
import { CHAIN_CONFIG_MAP } from "../config";
import { makeStyles } from '@mui/styles';

const useStyles = makeStyles((theme) => ({
  alert: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
}));

export default function ChainWarningMessage({ chainId }: { chainId: ChainId }) {
  const classes = useStyles();

  const warningMessage = useMemo(() => {
    return CHAIN_CONFIG_MAP[chainId]?.warningMessage;
  }, [chainId]);

  if (warningMessage === undefined) {
    return null;
  }

  return (
    <Alert variant="outlined" severity="warning" className={classes.alert}>
      {warningMessage.text}
      {warningMessage.link ? (
        <Typography component="div">
          <Link href={warningMessage.link.url} target="_blank" rel="noreferrer">
            {warningMessage.link.text}
          </Link>
        </Typography>
      ) : null}
    </Alert>
  );
}

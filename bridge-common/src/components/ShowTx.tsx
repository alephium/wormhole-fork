import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA
} from "@alephium/wormhole-sdk";
import { Button, Typography } from "@mui/material";
import { makeStyles } from 'tss-react/mui';
import { useTranslation } from "react-i18next";
import { Transaction } from "../store/transferSlice";
import { CLUSTER, getExplorerName } from "../utils/consts";
import { getTransactionLink } from "../utils/transaction";

const useStyles = makeStyles()((theme) => ({
  tx: {
    marginTop: theme.spacing(1),
    textAlign: "center",
  },
  viewButton: {
    marginTop: theme.spacing(1),
  },
}));

export default function ShowTx({
  chainId,
  tx,
}: {
  chainId: ChainId;
  tx: Transaction;
}) {
  const { t } = useTranslation();
  const { classes } = useStyles();
  const showExplorerLink =
    CLUSTER === "testnet" ||
    CLUSTER === "mainnet" ||
    (CLUSTER === "devnet" &&
      (chainId === CHAIN_ID_SOLANA || chainId === CHAIN_ID_TERRA));
  const explorerAddress = getTransactionLink(chainId, tx.id)
  const explorerName = getExplorerName(chainId);

  return (
    <div className={classes.tx}>
      <Typography noWrap component="div" variant="body2">
        {tx.id}
      </Typography>
      {showExplorerLink && explorerAddress ? (
        <Button
          href={explorerAddress}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          variant="outlined"
          className={classes.viewButton}
        >
          {t('View on {{ explorerName }}', { explorerName })}
        </Button>
      ) : null}
    </div>
  );
}

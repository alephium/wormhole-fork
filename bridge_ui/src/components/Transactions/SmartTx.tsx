import { Button, Tooltip, Typography } from "@mui/material";
import { makeStyles } from '@mui/styles';
import { FileCopy, OpenInNew } from "@mui/icons-material";
import { withStyles } from "@mui/styles";
import useCopyToClipboard from "../../hooks/useCopyToClipboard";
import { getExplorerName } from "../../utils/consts";
import { getTransactionLink, shortenTxId } from "../../utils/transaction";
import { BridgeTransaction } from ".";
import { useHistory } from "react-router-dom";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles((theme) => ({
  mainTypog: {
    display: "inline-block",
    marginRight: theme.spacing(1),
    textDecoration: "underline",
    textUnderlineOffset: "2px"
  },
  buttons: {
    marginLeft: ".5rem",
    marginRight: ".5rem"
  }
}))

const tooltipStyles = {
  tooltip: {
    minWidth: "max-content",
    textAlign: "center",
    "& > *": {
      margin: ".25rem"
    }
  }
}

// @ts-ignore
const StyledTooltip = withStyles(tooltipStyles)(Tooltip)

export default function SmartTx({ tx }: { tx: BridgeTransaction }) {
  const { t } = useTranslation()
  const classes = useStyles()
  const explorerAddress = getTransactionLink(tx.emitterChain, tx.txId)
  const explorerName = getExplorerName(tx.emitterChain)

  const copyToClipboard = useCopyToClipboard(tx.txId.toString())
  const { push } = useHistory()
  const redeemHandler = useCallback(() => {
    push(`/redeem?sourceChain=${tx.emitterChain}&transactionId=${tx.txId}`)
  }, [push, tx])

  const explorerButton = !explorerAddress ? null : (
    <Button
      size="small"
      variant="outlined"
      startIcon={<OpenInNew />}
      className={classes.buttons}
      href={explorerAddress}
      target="_blank"
      rel="noopener noreferrer"
    >
      {t("View on {{ explorerName }}", { explorerName })}
    </Button>
  );
  const copyButton = (
    <Button
      size="small"
      variant="outlined"
      startIcon={<FileCopy />}
      onClick={copyToClipboard}
      className={classes.buttons}
    >
      {t("Copy")}
    </Button>
  )
  const redeemButton = tx.status !== 'Confirmed' ? null : (
    <Button
      size="small"
      variant="outlined"
      onClick={redeemHandler}
      className={classes.buttons}
    >
      {t("Redeem")}
    </Button>
  )

  const tooltipContent = (
    <div>
      {explorerButton}
      {redeemButton}
      {copyButton}
    </div>
  )

  return (
    <StyledTooltip
      title={tooltipContent}
      className={classes.mainTypog}
    >
      <Typography
        variant={"body1"}
        className={classes.mainTypog}
        component="div"
      >
        {shortenTxId(tx.txId)}
      </Typography>
    </StyledTooltip>
  )
}

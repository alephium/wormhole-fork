import { makeStyles, Typography } from "@material-ui/core";
import { CHAIN_ID_ALEPHIUM } from "@alephium/wormhole-sdk";
import { hexToALPHAddress } from "../../utils/alephium";
import { CHAINS_BY_ID } from "../../utils/consts";
import SmartAddress from "../SmartAddress";
import { useTargetInfo } from "./Target";
import { useSelector } from "react-redux";
import { selectTransferAmount, selectTransferIsRecovery } from "../../store/selectors";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles((theme) => ({
  description: {
    textAlign: "center",
  },
}));

export default function TargetPreview() {
  const { t } = useTranslation();
  const classes = useStyles();
  const transferAmount = useSelector(selectTransferAmount)
  const {
    targetChain,
    readableTargetAddress,
    targetAsset,
    symbol,
    tokenName,
    logo,
  } = useTargetInfo();
  const isRecovery = useSelector(selectTransferIsRecovery);
  const amount = useMemo(() => {
    return !isRecovery ? `${transferAmount} ` : ''
  }, [isRecovery, transferAmount])

  const explainerContent =
    targetChain && readableTargetAddress ? (
      <>
        {targetAsset ? (
          <>
            <span>{t('and receive {{ amount }}', { amount })}</span>
            <SmartAddress
              chainId={targetChain}
              address={targetAsset}
              symbol={symbol}
              tokenName={tokenName}
              logo={logo}
              isAsset
            />
          </>
        ) : null}
        <span>{t("to")}</span>
        <SmartAddress chainId={targetChain} address={targetChain === CHAIN_ID_ALEPHIUM ? hexToALPHAddress(readableTargetAddress) : readableTargetAddress} />
        <span>{t("on {{ chainName }}", { chainName: CHAINS_BY_ID[targetChain].name })}</span>
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

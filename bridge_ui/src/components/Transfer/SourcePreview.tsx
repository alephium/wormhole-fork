import { Typography } from "@mui/material";
import { makeStyles } from '@mui/styles';
import numeral from "numeral";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import {
  selectSourceWalletAddress,
  selectTransferAmount,
  selectTransferRelayerFee,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccount,
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
  const sourceChain = useSelector(selectTransferSourceChain);
  const sourceParsedTokenAccount = useSelector(
    selectTransferSourceParsedTokenAccount
  );
  const sourceWalletAddress = useSelector(selectSourceWalletAddress);
  const sourceAmount = useSelector(selectTransferAmount);
  const relayerFee = useSelector(selectTransferRelayerFee);

  const explainerContent =
    sourceChain && sourceParsedTokenAccount ? (
      <>
        <span>
          {t('You will transfer {{ sourceAmount }}', { sourceAmount })}
          {relayerFee
            ? ` (+~${numeral(relayerFee).format("0.00")} ${t('Relayer Fee')})`
            : ""}
        </span>
        <SmartAddress
          chainId={sourceChain}
          parsedTokenAccount={sourceParsedTokenAccount}
          isAsset
        />
        {sourceWalletAddress ? (
          <>
            <span>{t("from")}</span>
            <SmartAddress chainId={sourceChain} address={sourceWalletAddress} />
          </>
        ) : null}
        <span>{t('on {{ chainName }}', { chainName: CHAINS_BY_ID[sourceChain].name })}</span>
      </>
    ) : (
      ""
    );

  return (
    <>
      <Typography
        component="div"
        variant="subtitle2"
        className={classes.description}
      >
        {explainerContent}
      </Typography>
    </>
  );
}

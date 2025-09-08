import { IconButton, makeStyles, Typography } from "@material-ui/core";
import { ArrowBack } from "@material-ui/icons";
import { useTranslation } from "react-i18next";
import SourcePreview from "../Transfer/SourcePreview";
import TargetPreview from "../Transfer/TargetPreview";
import { useSelector } from "react-redux";
import {
  selectTransferAmount,
  selectTransferSourceParsedTokenAccount,
  selectTransferSourceChain,
  selectSourceWalletAddress,
  selectTransferTargetChain,
} from "../../store/selectors";
import SmartAddress from "./SmartAddress";
import { CHAINS_BY_ID } from "../../utils/consts";
import { useMemo } from "react";
import { CHAIN_ID_ALEPHIUM } from "@alephium/wormhole-sdk";
import { hexToALPHAddress } from "../../utils/alephium";
import { useTargetInfo } from "../Transfer/Target";

interface ReviewStepProps {
  onBack: () => void;
}

const ReviewStep = ({ onBack }: ReviewStepProps) => {
  const { t } = useTranslation();
  const classes = useStyles();

  const sourceParsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount);
  const sourceAmount = useSelector(selectTransferAmount);

  const sourceChain = useSelector(selectTransferSourceChain);
  const sourceWalletAddress = useSelector(selectSourceWalletAddress);
  const sourceChainInfo = useMemo(() => CHAINS_BY_ID[sourceChain], [sourceChain]);

  const { targetChain, readableTargetAddress, targetAsset, symbol, tokenName, logo } = useTargetInfo();
  const targetChainInfo = useMemo(() => CHAINS_BY_ID[targetChain], [targetChain]);

  return (
    <>
      <div className={classes.header}>
        <IconButton
          size="small"
          style={{
            color: "rgba(255, 255, 255, 0.5)",
            backgroundColor: "rgb(30 30 31)",
          }}
          onClick={onBack}
        >
          <ArrowBack />
        </IconButton>
        <h1>Review</h1>
      </div>
      <div className={classes.chainSelectContainer}>
        {sourceParsedTokenAccount && (
          <div className={classes.tokenIconSymbolContainer}>
            <div className={classes.tokenRow}>
              <Typography style={{ fontWeight: "bold" }}>Bridging asset</Typography>
              <div className={classes.networkAddressText}>
                <div className={classes.tokenImageContainer2}>
                  {sourceParsedTokenAccount.logo && (
                    <img alt="" className={classes.tokenImage2} src={sourceParsedTokenAccount.logo} />
                  )}
                </div>
                <Typography style={{ fontWeight: "bold" }}>{sourceParsedTokenAccount.name}</Typography>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={classes.chainSelectContainer}>
        {sourceParsedTokenAccount && (
          <div className={classes.tokenIconSymbolContainer}>
            <div className={classes.tokenRow}>
              <Typography style={{ fontWeight: "bold" }}>Sending</Typography>
              <div className={classes.networkAddressText}>
                <Typography style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ fontWeight: "bold" }}>{sourceAmount}</span>{" "}
                  <SmartAddress chainId={sourceChain} parsedTokenAccount={sourceParsedTokenAccount} isAsset />
                  {sourceParsedTokenAccount.logo && (
                    <img alt="" className={classes.networkIcon} src={sourceParsedTokenAccount.logo} />
                  )}
                </Typography>
              </div>
            </div>
          </div>
        )}

        {sourceParsedTokenAccount && (
          <div className={classes.tokenIconSymbolContainer}>
            <div className={classes.tokenRow}>
              <Typography style={{ fontWeight: "bold" }}>From</Typography>
              <div className={classes.networkAddressText}>
                <Typography
                  style={{ display: "flex", alignItems: "center", gap: "5px", color: "rgba(255, 255, 255, 0.5)" }}
                >
                  <img src={sourceChainInfo.logo} alt={sourceChainInfo.name} className={classes.networkIcon} />
                  {sourceChainInfo.name} address
                </Typography>
                <SmartAddress chainId={sourceChain} address={sourceWalletAddress} />
              </div>
            </div>
          </div>
        )}

        <div className={classes.tokenRow}>
          <Typography style={{ fontWeight: "bold" }}>To</Typography>
          <div className={classes.networkAddressText}>
            <Typography
              style={{ display: "flex", alignItems: "center", gap: "5px", color: "rgba(255, 255, 255, 0.5)" }}
            >
              <img src={targetChainInfo.logo} alt={targetChainInfo.name} className={classes.networkIcon} />
              {targetChainInfo.name} address
            </Typography>
            <SmartAddress
              chainId={targetChain}
              address={
                targetChain === CHAIN_ID_ALEPHIUM ? hexToALPHAddress(readableTargetAddress) : readableTargetAddress
              }
            />
          </div>
        </div>

        {targetAsset && (
          <div className={classes.tokenIconSymbolContainer}>
            <div className={classes.tokenRow}>
              <Typography style={{ fontWeight: "bold" }}>Receiving</Typography>
              <div className={classes.networkAddressText}>
                <Typography style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ fontWeight: "bold" }}>{sourceAmount}</span>{" "}
                  <SmartAddress
                    chainId={targetChain}
                    address={targetAsset}
                    symbol={symbol}
                    tokenName={tokenName}
                    logo={logo}
                    isAsset
                  />
                  {logo && <img alt="" className={classes.networkIcon} src={logo} />}
                </Typography>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ReviewStep;

const useStyles = makeStyles((theme) => ({
  header: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
  },
  preview: {
    display: "flex",
    flexDirection: "column",
  },
  // TODO: DRY
  chainSelectContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "14px",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "20px",
  },
  tokenImageContainer2: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
  },
  tokenIconSymbolContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "5px",
  },
  tokenImage2: {
    maxHeight: "2rem",
    maxWidth: "100%",
  },
  tokenRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  networkAddressText: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  networkIcon: {
    height: "1rem",
    width: "1rem",
  },
}));

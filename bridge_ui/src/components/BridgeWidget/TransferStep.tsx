import { IconButton, makeStyles, Typography } from "@material-ui/core";
import {
  ArrowBack,
  CheckBoxOutlineBlankRounded,
  CheckBoxRounded,
  CheckCircleOutlineRounded,
  CheckCircle,
  RadioButtonUncheckedRounded,
} from "@material-ui/icons";
import { useSelector } from "react-redux";
import {
  selectTransferAmount,
  selectTransferSourceParsedTokenAccount,
  selectTransferSourceChain,
  selectSourceWalletAddress,
  selectTransferRelayerFee,
  selectTransferSourceAsset,
  selectTransferIsSendComplete,
  selectTransferTransferTx,
  selectTransferIsWalletApproved,
  selectTransferIsSending,
} from "../../store/selectors";
import SmartAddress from "./SmartAddress";
import { CHAINS_BY_ID } from "../../utils/consts";
import { useCallback, useMemo, useState } from "react";
import { CHAIN_ID_ALEPHIUM, isEVMChain } from "@alephium/wormhole-sdk";
import { hexToALPHAddress } from "../../utils/alephium";
import { useTargetInfo } from "../Transfer/Target";
import numeral from "numeral";
import useAllowance from "../../hooks/useAllowance";
import { formatUnits, parseUnits } from "ethers/lib/utils";
import { useTranslation } from "react-i18next";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import { useHandleTransfer } from "../../hooks/useHandleTransfer";
import BridgeWidgetButton from "./BridgeWidgetButton";
import SendConfirmationDialog from "../Transfer/SendConfirmationDialog";
import WaitingForWalletMessage from "../Transfer/WaitingForWalletMessage";
import ShowTx from "../ShowTx";
import TransactionProgress from "../TransactionProgress";
import useTransferSignedVAA from "../../hooks/useTransferSignedVAA";

interface TransferStepProps {
  onBack: () => void;
}

const GRAY = "rgba(255, 255, 255, 0.5)";

const TransferStep = ({ onBack }: TransferStepProps) => {
  const classes = useStyles();
  const { t } = useTranslation();

  const sourceParsedTokenAccount = useSelector(selectTransferSourceParsedTokenAccount);
  const sourceAmount = useSelector(selectTransferAmount);

  const sourceChain = useSelector(selectTransferSourceChain);
  const sourceWalletAddress = useSelector(selectSourceWalletAddress);
  const sourceAsset = useSelector(selectTransferSourceAsset);
  const sourceChainInfo = useMemo(() => CHAINS_BY_ID[sourceChain], [sourceChain]);
  const relayerFee = useSelector(selectTransferRelayerFee);
  const sourceDecimals = sourceParsedTokenAccount?.decimals;
  const sourceIsNative = sourceParsedTokenAccount?.isNativeAsset;
  const baseAmountParsed =
    sourceDecimals !== undefined && sourceDecimals !== null && sourceAmount && parseUnits(sourceAmount, sourceDecimals);
  const feeParsed = sourceDecimals !== undefined ? parseUnits(relayerFee || "0", sourceDecimals) : 0;
  const transferAmountParsed = baseAmountParsed && baseAmountParsed.add(feeParsed).toBigInt();

  const { targetChain, readableTargetAddress, targetAsset, symbol, tokenName, logo } = useTargetInfo();
  const targetChainInfo = useMemo(() => CHAINS_BY_ID[targetChain], [targetChain]);

  const { sufficientAllowance, isAllowanceFetching, isApproveProcessing, approveAmount } = useAllowance(
    sourceChain,
    sourceAsset,
    transferAmountParsed || undefined,
    sourceIsNative
  );

  const approveButtonNeeded = isEVMChain(sourceChain) && !sufficientAllowance;
  const [allowanceError, setAllowanceError] = useState("");

  const approveExactAmount = useMemo(() => {
    return () => {
      setAllowanceError("");
      approveAmount(BigInt(transferAmountParsed)).then(
        () => {
          setAllowanceError("");
        },
        (error) => setAllowanceError(t("Failed to approve the token transfer."))
      );
    };
  }, [approveAmount, transferAmountParsed, t]);

  const { isReady, statusMessage, walletAddress } = useIsWalletReady(sourceChain);
  const isWrongWallet = sourceWalletAddress && walletAddress && sourceWalletAddress !== walletAddress;
  const { handleClick, disabled, showLoader } = useHandleTransfer();

  const isDisabled = !isReady || isWrongWallet || disabled || isAllowanceFetching || isApproveProcessing;

  const humanReadableTransferAmount =
    sourceDecimals !== undefined &&
    sourceDecimals !== null &&
    transferAmountParsed &&
    formatUnits(transferAmountParsed, sourceDecimals);
  let tokensAmount = 0;
  try {
    tokensAmount = parseInt((humanReadableTransferAmount || sourceAmount).toString());
  } catch (e) {
    console.error(e);
  }

  const transferTx = useSelector(selectTransferTransferTx);
  const isSendComplete = useSelector(selectTransferIsSendComplete);

  const isWalletApproved = useSelector(selectTransferIsWalletApproved);

  return (
    <>
      <div className={classes.header}>
        <IconButton
          size="small"
          style={{
            color: GRAY,
            backgroundColor: "rgb(30 30 31)",
          }}
          onClick={onBack}
        >
          <ArrowBack />
        </IconButton>
        <h1 style={{ margin: 0 }}>Bridging</h1>
      </div>

      <div className={classes.chainSelectContainer}>
        <Typography style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255, 255, 255, 0.5)" }}>
          Transferring tokens from your {sourceChainInfo.name} wallet to the Alephium bridge:
        </Typography>
        <TransferProgress />
      </div>

      <div className={classes.chainSelectContainer}>
        <Typography style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255, 255, 255, 0.5)" }}>
          Redeeming tokens on the Alephium bridge to your {targetChainInfo.name} wallet:
        </Typography>
        {/* <TransferProgress /> */}
      </div>

      <WaitingForWalletMessage />
      {transferTx ? <ShowTx chainId={sourceChain} tx={transferTx} /> : null}
      <TransactionProgress chainId={sourceChain} tx={transferTx} isSendComplete={isSendComplete} />
    </>
  );
};

const TransferProgress = () => {
  const classes = useStyles();
  const transferTx = useSelector(selectTransferTransferTx);
  const isSendComplete = useSelector(selectTransferIsSendComplete);
  const signedVAA = useTransferSignedVAA();
  const isSending = useSelector(selectTransferIsSending);
  const sourceChain = useSelector(selectTransferSourceChain);

  const isWalletApproved = useSelector(selectTransferIsWalletApproved);

  const step3Completed = !!signedVAA;
  const step2Completed = !!transferTx;
  const step1Completed = isWalletApproved || step2Completed;

  return (
    <div>
      <div className={classes.transferProgressRow}>
        <div className={classes.transferProgressIcon}>
          {step1Completed ? <CheckCircleOutlineRounded /> : <RadioButtonUncheckedRounded />}
        </div>
        <div className={classes.transferProgressContent}>
          <Typography>{step1Completed ? "Got wallet approval!" : "Waiting for wallet approval..."}</Typography>
        </div>
      </div>

      <div className={classes.transferProgressRow} style={{ color: step1Completed ? "inherit" : GRAY }}>
        <div className={classes.transferProgressIcon}>
          {step2Completed ? <CheckCircleOutlineRounded /> : <RadioButtonUncheckedRounded />}
        </div>
        <div className={classes.transferProgressContent}>
          {step2Completed ? (
            <>
              <Typography>Transaction confirmed:</Typography>
              <SmartAddress chainId={sourceChain} transactionAddress={transferTx.id} />
            </>
          ) : (
            <Typography>Waiting for transaction confirmation...</Typography>
          )}
        </div>
      </div>

      <div className={classes.transferProgressRow} style={{ color: step2Completed ? "inherit" : GRAY }}>
        <div className={classes.transferProgressIcon}>
          {step3Completed ? <CheckCircleOutlineRounded /> : <RadioButtonUncheckedRounded />}
        </div>
        <div className={classes.transferProgressContent}>
          {step3Completed ? (
            <Typography>The tokens have entered the bridge!</Typography>
          ) : (
            <Typography>Waiting for VAA confirmation...</Typography>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferStep;

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
  transferProgressRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  transferProgressIcon: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
  },
  transferProgressContent: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
}));

import { CircularProgress, IconButton, LinearProgress, makeStyles, styled, Typography } from "@material-ui/core";
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
  selectTransferIsRedeemComplete,
} from "../../store/selectors";
import SmartAddress from "./SmartAddress";
import { ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL, CHAINS_BY_ID, CLUSTER } from "../../utils/consts";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CHAIN_ID_ALEPHIUM, CHAIN_ID_ETH, isEVMChain } from "@alephium/wormhole-sdk";
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
import { ethers } from "ethers";
import { useWallet } from "@alephium/web3-react";
import { useEthereumProvider } from "../../contexts/EthereumProviderContext";
import {
  DefaultEVMChainConfirmations,
  EpochDuration,
  getEVMCurrentBlockNumber,
  getEvmJsonRpcProvider,
} from "../../utils/evm";
import RedeemPreview from "../Transfer/RedeemPreview";
import Redeem from "../Transfer/Redeem";

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

  const isWalletApproved = useSelector(selectTransferIsWalletApproved);

  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete);

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
          Receiving tokens from the Alephium bridge to your {targetChainInfo.name} wallet:
        </Typography>

        <RedeemProgress />
      </div>

      {/* <WaitingForWalletMessage />
      {transferTx ? <ShowTx chainId={sourceChain} tx={transferTx} /> : null}
      <TransactionProgress chainId={sourceChain} tx={transferTx} isSendComplete={isSendComplete} /> */}
    </>
  );
};

const RedeemProgress = () => {
  const classes = useStyles();
  const isSendComplete = useSelector(selectTransferIsSendComplete);

  return (
    <div className={classes.transferProgressContainer}>
      <div className={classes.transferProgressRow} style={{ color: isSendComplete ? "inherit" : GRAY }}>
        <div className={classes.transferProgressIcon}>
          {isSendComplete ? (
            <CircularProgress size={20} style={{ color: "rgba(255, 255, 255, 0.5)" }} />
          ) : (
            <RadioButtonUncheckedRounded />
          )}
        </div>
        <div className={classes.transferProgressContent}>
          <Typography>Waiting for a relayer to process your transfer...</Typography>
        </div>
      </div>
    </div>
    // {isRedeemComplete ? <RedeemPreview /> : <Redeem />}
  );
};

const TransferProgress = () => {
  const classes = useStyles();
  const transferTx = useSelector(selectTransferTransferTx);
  const isSendComplete = useSelector(selectTransferIsSendComplete);
  const signedVAA = useTransferSignedVAA();
  // const isSending = useSelector(selectTransferIsSending);
  const sourceChain = useSelector(selectTransferSourceChain);

  const isWalletApproved = useSelector(selectTransferIsWalletApproved);

  const step4Completed = !!signedVAA;
  const step2Completed = !!transferTx;
  const step1Completed = isWalletApproved || step2Completed;

  return (
    <div className={classes.transferProgressContainer}>
      <div className={classes.transferProgressRow}>
        <div className={classes.transferProgressIcon}>
          {step1Completed ? (
            <CheckCircleOutlineRounded style={{ color: "#189b3c" }} />
          ) : (
            <CircularProgress size={20} style={{ color: "rgba(255, 255, 255, 0.5)" }} />
          )}
        </div>
        <div className={classes.transferProgressContent}>
          <Typography style={{ fontWeight: step1Completed ? 600 : 400 }}>
            {step1Completed ? "Got wallet approval!" : "Waiting for wallet approval..."}
          </Typography>
        </div>
      </div>

      <div className={classes.transferProgressRow} style={{ color: step1Completed ? "inherit" : GRAY }}>
        <div className={classes.transferProgressIcon}>
          {step2Completed ? (
            <CheckCircleOutlineRounded style={{ color: "#189b3c" }} />
          ) : step1Completed ? (
            <CircularProgress size={20} style={{ color: "rgba(255, 255, 255, 0.5)" }} />
          ) : (
            <RadioButtonUncheckedRounded />
          )}
        </div>
        <div className={classes.transferProgressContent}>
          {step2Completed ? (
            <div className={classes.tokenRow}>
              <Typography style={{ fontWeight: 600 }}>The transaction has confirmed!</Typography>
              <SmartAddress chainId={sourceChain} transactionAddress={transferTx.id} />
            </div>
          ) : (
            <Typography>Waiting for the transaction to confirm...</Typography>
          )}
        </div>
      </div>

      <FinalityProgress isActive={step2Completed} />

      <div className={classes.transferProgressRow} style={{ color: step2Completed ? "inherit" : GRAY }}>
        <div className={classes.transferProgressIcon}>
          {step4Completed ? (
            <CheckCircleOutlineRounded style={{ color: "#189b3c" }} />
          ) : !isSendComplete ? (
            <CircularProgress size={20} style={{ color: "rgba(255, 255, 255, 0.5)" }} />
          ) : (
            <RadioButtonUncheckedRounded />
          )}
        </div>
        <div className={classes.transferProgressContent}>
          {step4Completed ? (
            <Typography>The tokens have entered the bridge!</Typography>
          ) : (
            <Typography>Waiting for tokens to enter the bridge...</Typography>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransferStep;

const BorderLinearProgress = styled(LinearProgress)(({ theme }) => ({
  height: 10,
  borderRadius: 5,
  [`&.MuiLinearProgress-colorPrimary`]: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  [`& .MuiLinearProgress-barColorPrimary`]: {
    borderRadius: 5,
    backgroundColor: "#0045ff",
  },
}));

const FinalityProgress = ({ isActive }: { isActive: boolean }) => {
  const classes = useStyles();
  const tx = useSelector(selectTransferTransferTx);
  const sourceChain = useSelector(selectTransferSourceChain);

  const remainingBlocksForFinality = useRemainingBlocksForFinality();

  const [initialRemainingBlocks, setInitialRemainingBlocks] = useState<number>();

  useEffect(() => {
    if (initialRemainingBlocks || !remainingBlocksForFinality) return;

    setInitialRemainingBlocks(remainingBlocksForFinality);
  }, [initialRemainingBlocks, remainingBlocksForFinality]);

  const showProgress = tx && remainingBlocksForFinality !== undefined && initialRemainingBlocks !== undefined;
  const isCompleted = remainingBlocksForFinality === 0;

  const [progress, setProgress] = useState<number>(0);

  // Add fake progress timer
  useEffect(() => {
    if (!isActive || !showProgress || isCompleted) return;

    const interval = setInterval(() => {
      setProgress((prev) => {
        // Add 0.1 to the current progress
        const newProgress = prev + 0.1;

        return newProgress;
      });
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, [isActive, isCompleted, showProgress]);

  useEffect(() => {
    if (isActive && showProgress) {
      setProgress(100 - (remainingBlocksForFinality / initialRemainingBlocks) * 100);
    }
  }, [isActive, showProgress, remainingBlocksForFinality, initialRemainingBlocks]);

  return (
    <div>
      <div className={classes.transferProgressRow} style={{ color: isActive ? "inherit" : GRAY }}>
        <div className={classes.transferProgressIcon}>
          {isCompleted ? (
            <CheckCircleOutlineRounded style={{ color: "#189b3c" }} />
          ) : isActive ? (
            <CircularProgress size={20} style={{ color: "rgba(255, 255, 255, 0.5)" }} />
          ) : (
            <RadioButtonUncheckedRounded />
          )}
        </div>
        <div className={classes.finalityProgressContent}>
          {isCompleted ? (
            <Typography>Block has been finalized!</Typography>
          ) : isActive && showProgress ? (
            <div className={classes.tokenRow}>
              <Typography>Remaining blocks for finality:</Typography>
              <Typography style={{ fontWeight: 600 }}>{remainingBlocksForFinality}</Typography>
            </div>
          ) : (
            <div className={classes.tokenRow}>
              <Typography>Waiting for block finality...</Typography>
            </div>
          )}
          {!isCompleted && isActive && showProgress && (
            <div>
              <BorderLinearProgress value={progress} variant="determinate" style={{ marginBottom: 5 }} />

              {sourceChain === CHAIN_ID_ETH && (
                <div style={{ color: GRAY, textAlign: "right" }}>It may take up to 15 minutes.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const useRemainingBlocksForFinality = () => {
  const currentBlockHeight = useFetchCurrentBlockNumber();
  const sourceChain = useSelector(selectTransferSourceChain);
  const tx = useSelector(selectTransferTransferTx);

  const isEthereum = sourceChain === CHAIN_ID_ETH && CLUSTER !== "devnet";
  const isAlephium = sourceChain === CHAIN_ID_ALEPHIUM;

  if (!tx || !currentBlockHeight) return undefined;

  const remainingBlocksUntilTxBlock = tx.blockHeight - currentBlockHeight;
  const remainingBlocksForFinality = isEthereum
    ? remainingBlocksUntilTxBlock
    : isAlephium
    ? remainingBlocksUntilTxBlock + ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL
    : remainingBlocksUntilTxBlock + DefaultEVMChainConfirmations;

  return remainingBlocksForFinality > 0 ? remainingBlocksForFinality : 0;
};

const useFetchCurrentBlockNumber = () => {
  const { provider } = useEthereumProvider();
  const alphWallet = useWallet();
  const [currentBlock, setCurrentBlock] = useState<number>();
  const [evmProvider, setEvmProvider] = useState<ethers.providers.Provider | undefined>(provider);
  const [lastBlockUpdatedTs, setLastBlockUpdatedTs] = useState(Date.now());

  const isSendComplete = useSelector(selectTransferIsSendComplete);
  const tx = useSelector(selectTransferTransferTx);
  const sourceChain = useSelector(selectTransferSourceChain);

  useEffect(() => {
    if (isSendComplete || !tx) return;

    if (isEVMChain(sourceChain) && evmProvider) {
      let cancelled = false;
      (async () => {
        while (!cancelled) {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          try {
            const newBlock = await getEVMCurrentBlockNumber(evmProvider, sourceChain);
            console.log("newBlock", newBlock);
            if (!cancelled) {
              setCurrentBlock((prev) => {
                const now = Date.now();
                if (prev === newBlock && now - lastBlockUpdatedTs > EpochDuration && evmProvider === provider) {
                  setEvmProvider(getEvmJsonRpcProvider(sourceChain));
                } else if (prev !== newBlock) {
                  setLastBlockUpdatedTs(now);
                }
                return newBlock;
              });
            }
          } catch (e) {
            console.error(e);
          }
        }
      })();

      return () => {
        cancelled = true;
      };
    }

    if (sourceChain === CHAIN_ID_ALEPHIUM && alphWallet?.nodeProvider !== undefined) {
      let cancelled = false;
      (async (nodeProvider) => {
        while (!cancelled) {
          const timeout = CLUSTER === "devnet" ? 1000 : 10000;
          await new Promise((resolve) => setTimeout(resolve, timeout));
          try {
            const chainInfo = await nodeProvider.blockflow.getBlockflowChainInfo({
              fromGroup: alphWallet.account.group,
              toGroup: alphWallet.account.group,
            });
            if (!cancelled) {
              setCurrentBlock(chainInfo.currentHeight);
            }
          } catch (e) {
            console.error(e);
          }
        }
      })(alphWallet.nodeProvider);
      return () => {
        cancelled = true;
      };
    }
  }, [isSendComplete, sourceChain, provider, alphWallet, tx, lastBlockUpdatedTs, evmProvider]);

  return currentBlock;
};

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
    alignItems: "flex-start",
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
    width: "100%",
  },
  finalityProgressContent: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
    width: "100%",
  },
  transferProgressContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
}));

import {
  CHAIN_ID_ACALA,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_AURORA,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  CHAIN_ID_ETHEREUM_ROPSTEN,
  CHAIN_ID_FANTOM,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_NEON,
  CHAIN_ID_OASIS,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  isEVMChain,
  WSOL_ADDRESS,
} from "@alephium/wormhole-sdk";
import {
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Link,
  Tooltip,
  Typography,
} from "@mui/material";
import { makeStyles } from '@mui/styles';
import { Alert } from "@mui/material";
import { useCallback, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import useGetIsTransferCompleted from "../../hooks/useGetIsTransferCompleted";
import { useHandleRedeem } from "../../hooks/useHandleRedeem";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import {
  selectTransferIsRecovery,
  selectTransferTargetAsset,
  selectTransferTargetChain,
  selectTransferUseRelayer,
} from "../../store/selectors";
import { reset } from "../../store/transferSlice";
import {
  CHAINS_BY_ID,
  CLUSTER,
  getHowToAddTokensToWalletUrl,
  ROPSTEN_WETH_ADDRESS,
  WAVAX_ADDRESS,
  WBNB_ADDRESS,
  WETH_ADDRESS,
  WETH_AURORA_ADDRESS,
  WFTM_ADDRESS,
  WKLAY_ADDRESS,
  WMATIC_ADDRESS,
  WNEON_ADDRESS,
  WROSE_ADDRESS,
} from "../../utils/consts";
import ButtonWithLoader from "../ButtonWithLoader";
import KeyAndBalance from "../KeyAndBalance";
import SmartAddress from "../SmartAddress";
import { SolanaCreateAssociatedAddressAlternate } from "../SolanaCreateAssociatedAddress";
import SolanaTPSWarning from "../SolanaTPSWarning";
import StepDescription from "../StepDescription";
import AddToMetamask from "./AddToMetamask";
import RedeemPreview from "./RedeemPreview";
import WaitingForWalletMessage from "./WaitingForWalletMessage";
import { useSnackbar, VariantType } from "notistack";
import AddToAlephium from "./AddToAlephium";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles((theme) => ({
  alert: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  centered: {
    margin: theme.spacing(4, 0, 2),
    textAlign: "center",
  },
}));

function Redeem() {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar()
  const {
    handleClick,
    handleNativeClick,
    handleAcalaRelayerRedeemClick,
    disabled,
    showLoader,
  } = useHandleRedeem();
  const useRelayer = useSelector(selectTransferUseRelayer);
  const targetChain = useSelector(selectTransferTargetChain);
  const useAutoRelayer = targetChain === CHAIN_ID_ALEPHIUM
  const [manualRedeem, setManualRedeem] = useState(!useRelayer && !useAutoRelayer);
  const handleManuallyRedeemClick = useCallback(() => {
    setManualRedeem(true);
  }, []);
  const handleSwitchToRelayViewClick = useCallback(() => {
    if (useRelayer) {
      setManualRedeem(false);
    }
  }, [useRelayer]);
  const targetIsAcala =
    targetChain === CHAIN_ID_ACALA || targetChain === CHAIN_ID_KARURA;
  const targetAsset = useSelector(selectTransferTargetAsset);
  const isRecovery = useSelector(selectTransferIsRecovery);
  const shouldCheckCompletion = useRelayer || useAutoRelayer
  const { isTransferCompletedLoading, isTransferCompleted, error: checkTransferCompletedError } =
    useGetIsTransferCompleted(!shouldCheckCompletion, shouldCheckCompletion ? 5000 : undefined);
  const classes = useStyles();
  const dispatch = useDispatch();
  const { isReady, statusMessage } = useIsWalletReady(targetChain);
  //TODO better check, probably involving a hook & the VAA
  const isEthNative =
    targetChain === CHAIN_ID_ETH &&
    targetAsset &&
    targetAsset.toLowerCase() === WETH_ADDRESS.toLowerCase();
  const isEthRopstenNative =
    targetChain === CHAIN_ID_ETHEREUM_ROPSTEN &&
    targetAsset &&
    targetAsset.toLowerCase() === ROPSTEN_WETH_ADDRESS.toLowerCase();
  const isBscNative =
    targetChain === CHAIN_ID_BSC &&
    targetAsset &&
    targetAsset.toLowerCase() === WBNB_ADDRESS.toLowerCase();
  const isPolygonNative =
    targetChain === CHAIN_ID_POLYGON &&
    targetAsset &&
    targetAsset.toLowerCase() === WMATIC_ADDRESS.toLowerCase();
  const isAvaxNative =
    targetChain === CHAIN_ID_AVAX &&
    targetAsset &&
    targetAsset.toLowerCase() === WAVAX_ADDRESS.toLowerCase();
  const isOasisNative =
    targetChain === CHAIN_ID_OASIS &&
    targetAsset &&
    targetAsset.toLowerCase() === WROSE_ADDRESS.toLowerCase();
  const isAuroraNative =
    targetChain === CHAIN_ID_AURORA &&
    targetAsset &&
    targetAsset.toLowerCase() === WETH_AURORA_ADDRESS.toLowerCase();
  const isFantomNative =
    targetChain === CHAIN_ID_FANTOM &&
    targetAsset &&
    targetAsset.toLowerCase() === WFTM_ADDRESS.toLowerCase();
  const isKlaytnNative =
    targetChain === CHAIN_ID_KLAYTN &&
    targetAsset &&
    targetAsset.toLowerCase() === WKLAY_ADDRESS.toLowerCase();
  const isNeonNative =
    targetChain === CHAIN_ID_NEON &&
    targetAsset &&
    targetAsset.toLowerCase() === WNEON_ADDRESS.toLowerCase();
  const isSolNative =
    targetChain === CHAIN_ID_SOLANA &&
    targetAsset &&
    targetAsset === WSOL_ADDRESS;
  const isNativeEligible =
    isEthNative ||
    isEthRopstenNative ||
    isBscNative ||
    isPolygonNative ||
    isAvaxNative ||
    isOasisNative ||
    isAuroraNative ||
    isFantomNative ||
    isKlaytnNative ||
    isNeonNative ||
    isSolNative;
  const [useNativeRedeem, setUseNativeRedeem] = useState(true);
  const toggleNativeRedeem = useCallback(() => {
    setUseNativeRedeem(!useNativeRedeem);
  }, [useNativeRedeem]);
  const handleResetClick = useCallback(() => {
    dispatch(reset());
  }, [dispatch]);
  const howToAddTokensUrl = getHowToAddTokensToWalletUrl(targetChain);

  const relayerContent = (
    <>
      {isEVMChain(targetChain) && !isTransferCompleted && !targetIsAcala ? (
        <KeyAndBalance chainId={targetChain} />
      ) : null}

      {!isReady &&
      isEVMChain(targetChain) &&
      !isTransferCompleted &&
      !targetIsAcala ? (
        <Typography className={classes.centered}>
          {t("Please connect your wallet to check for transfer completion.")}
        </Typography>
      ) : null}

      {(!isEVMChain(targetChain) || isReady) &&
      !isTransferCompleted &&
      !targetIsAcala ? (
        <div className={classes.centered}>
          <CircularProgress style={{ marginBottom: 16 }} />
          <Typography>
            {t("Waiting for a relayer to process your transfer.")}
          </Typography>
          <Tooltip title={t("Your fees will be refunded on the target chain")}>
            <Button
              onClick={handleManuallyRedeemClick}
              size="small"
              variant="outlined"
              style={{ marginTop: 16 }}
            >
              {t("Manually redeem instead")}
            </Button>
          </Tooltip>
        </div>
      ) : null}

      {/* TODO: handle recovery */}
      {targetIsAcala && !isTransferCompleted ? (
        <div className={classes.centered}>
          <ButtonWithLoader
            disabled={disabled}
            onClick={handleAcalaRelayerRedeemClick}
            showLoader={showLoader}
          >
            <span>
              {t("Redeem")} ({t("{{ chainName }} pays gas for you", { chainName: CHAINS_BY_ID[targetChain].name })})
            </span>
          </ButtonWithLoader>
          <Button
            onClick={handleManuallyRedeemClick}
            size="small"
            variant="outlined"
            style={{ marginTop: 16 }}
          >
            {t("Manually redeem instead")}
          </Button>
        </div>
      ) : null}

      {isTransferCompleted ? (
        <RedeemPreview overrideExplainerString={`${t('Success!')} ${t("Your transfer is complete.")}`} />
      ) : null}
    </>
  );

  const showAlert = (error: string, variant: VariantType) => {
    enqueueSnackbar(error, {
      variant: variant,
      preventDuplicate: true
    })
  }

  const nonRelayContent = (
    <>
      <KeyAndBalance chainId={targetChain} />
      {isNativeEligible && (
        <FormControlLabel
          control={
            <Checkbox
              checked={useNativeRedeem}
              onChange={toggleNativeRedeem}
            />
          }
          label={t("Automatically unwrap to native currency")}
        />
      )}
      {targetChain === CHAIN_ID_SOLANA && CLUSTER === "mainnet" && (
        <SolanaTPSWarning />
      )}
      {targetChain === CHAIN_ID_SOLANA ? (
        <SolanaCreateAssociatedAddressAlternate />
      ) : null}

      <>
        {" "}
        <ButtonWithLoader
          //TODO disable when the associated token account is confirmed to not exist
          disabled={
            !isReady ||
            disabled ||
            (isRecovery && (isTransferCompletedLoading || isTransferCompleted)) ||
            checkTransferCompletedError !== undefined
          }
          onClick={
            isNativeEligible && useNativeRedeem
              ? handleNativeClick
              : handleClick
          }
          showLoader={showLoader || (isRecovery && isTransferCompletedLoading)}
          error={statusMessage}
        >
          Redeem
        </ButtonWithLoader>
        <WaitingForWalletMessage />
      </>

      {checkTransferCompletedError !== undefined ? showAlert(checkTransferCompletedError, 'error')  : null}

      {useRelayer && !isTransferCompleted ? (
        <div className={classes.centered}>
          <Button
            onClick={handleSwitchToRelayViewClick}
            size="small"
            variant="outlined"
            style={{ marginTop: 16 }}
          >
            {t("Return to relayer view")}
          </Button>
        </div>
      ) : null}

      {isRecovery && isReady && isTransferCompleted ? (
        <>
          <Alert severity="info" variant="outlined" className={classes.alert}>
            {t("These tokens have already been redeemed.")}{" "}
            {!isEVMChain(targetChain) && howToAddTokensUrl ? (
              <Link
                href={howToAddTokensUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("Click here to see how to add them to your wallet.")}
              </Link>
            ) : null}
          </Alert>
          {targetAsset ? (
            <>
              <span>{t("Token Address")}:</span>
              <SmartAddress
                chainId={targetChain}
                address={targetAsset || undefined}
                isAsset
              />
            </>
          ) : null}
          {targetChain === CHAIN_ID_ALEPHIUM ? <AddToAlephium /> : null}
          {isEVMChain(targetChain) ? <AddToMetamask /> : null}
          <ButtonWithLoader onClick={handleResetClick}>
            {t("Transfer More Tokens!")}
          </ButtonWithLoader>
        </>
      ) : null}
    </>
  );

  return (
    <>
      <StepDescription>{t("Receive the tokens on the target chain")}</StepDescription>
      {manualRedeem ? nonRelayContent : relayerContent}
    </>
  );
}

export default Redeem;

import { CHAIN_ID_ALEPHIUM, ChainId, isEVMChain } from "@alephium/wormhole-sdk";
import { Button, ButtonProps, Container, makeStyles, Step, StepButton, StepContent, Stepper } from "@material-ui/core";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { useLocation } from "react-router";
import useCheckIfWormholeWrapped from "../../hooks/useCheckIfWormholeWrapped";
import useFetchTargetAsset from "../../hooks/useFetchTargetAsset";
import {
  selectTransferActiveStep,
  selectTransferIsRedeemComplete,
  selectTransferIsRedeeming,
  selectTransferIsSendComplete,
  selectTransferIsSending,
  selectTransferSourceChain,
  selectTransferTargetChain,
} from "../../store/selectors";
import { setSourceChain, setStep, setTargetChain } from "../../store/transferSlice";
import { CHAINS_BY_ID } from "../../utils/consts";
import ChainSelect from "../ChainSelect";
import Source2 from "./Source2";
import useIsWalletReady from "../../hooks/useIsWalletReady";
import EvmConnectWalletDialog from "../EvmConnectWalletDialog";
import { AlephiumConnectButton } from "@alephium/web3-react";
import { useEthereumProvider } from "../../contexts/EthereumProviderContext";

function BridgeWidget() {
  const { t } = useTranslation();
  useCheckIfWormholeWrapped();
  useFetchTargetAsset();
  const dispatch = useDispatch();
  const activeStep = useSelector(selectTransferActiveStep);
  const isSending = useSelector(selectTransferIsSending);
  const isSendComplete = useSelector(selectTransferIsSendComplete);
  const isRedeeming = useSelector(selectTransferIsRedeeming);
  const isRedeemComplete = useSelector(selectTransferIsRedeemComplete);
  const preventNavigation = (isSending || isSendComplete || isRedeeming) && !isRedeemComplete;
  const classes = useStyles();

  const { search } = useLocation();
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const pathSourceChain = query.get("sourceChain");
  const pathTargetChain = query.get("targetChain");

  //This effect initializes the state based on the path params
  useEffect(() => {
    if (!pathSourceChain && !pathTargetChain) {
      return;
    }
    try {
      const sourceChain: ChainId = CHAINS_BY_ID[parseFloat(pathSourceChain || "") as ChainId]?.id;
      const targetChain: ChainId = CHAINS_BY_ID[parseFloat(pathTargetChain || "") as ChainId]?.id;

      if (sourceChain === targetChain) {
        return;
      }
      if (sourceChain) {
        dispatch(setSourceChain(sourceChain));
      }
      if (targetChain) {
        dispatch(setTargetChain(targetChain));
      }
    } catch (e) {
      console.error("Invalid path params specified.");
    }
  }, [pathSourceChain, pathTargetChain, dispatch]);

  useEffect(() => {
    if (preventNavigation) {
      window.onbeforeunload = () => true;
      return () => {
        window.onbeforeunload = null;
      };
    }
  }, [preventNavigation]);
  return (
    <Container maxWidth="md" style={{ margin: "0 auto" }}>
      <div className={classes.mainBox}>
        <div className={classes.stack}>
          <Source2 />
          <NextActionButton />
        </div>
      </div>
    </Container>
  );
}

export default BridgeWidget;

const NextActionButton = () => {
  const sourceChain = useSelector(selectTransferSourceChain);
  const targetChain = useSelector(selectTransferTargetChain);
  const { isReady: isSourceReady } = useIsWalletReady(sourceChain);
  const { isReady: isTargetReady } = useIsWalletReady(targetChain);

  if (!isSourceReady) {
    return <ConnectButton chainId={sourceChain} />;
  }

  if (!isTargetReady) {
    return <ConnectButton chainId={targetChain} />;
  }

  return null;
};

const ConnectButton = ({ chainId }: { chainId: ChainId }) => {
  const [isOpen, setIsOpen] = useState(false);

  const openDialog = () => {
    setIsOpen(true);
  };
  const closeDialog = () => {
    setIsOpen(false);
  };

  if (isEVMChain(chainId)) {
    return (
      <>
        <ConnectButtonStyled variant="contained" color="primary" fullWidth onClick={openDialog}>
          Connect {CHAINS_BY_ID[chainId].name} wallet
        </ConnectButtonStyled>
        <EvmConnectWalletDialog isOpen={isOpen} onClose={closeDialog} chainId={chainId} />
      </>
    );
  }

  if (chainId === CHAIN_ID_ALEPHIUM) {
    return (
      <AlephiumConnectButton.Custom displayAccount={(account) => account.address}>
        {({ show }) => {
          return (
            <ConnectButtonStyled variant="contained" color="primary" fullWidth onClick={show}>
              Connect Alephium wallet
            </ConnectButtonStyled>
          );
        }}
      </AlephiumConnectButton.Custom>
    );
  }

  return null;
};

const ConnectButtonStyled = (props: ButtonProps) => {
  const classes = useConnectButtonStyles();
  return <Button {...props} className={classes.connectButton} />;
};

const useStyles = makeStyles((theme) => ({
  mainBox: {
    backgroundColor: "rgba(22, 22, 22, 0.5)",
    borderRadius: "20px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    width: "452px",
    gap: "16px",
    backdropFilter: "blur(4px)",
    margin: "0 auto",
  },
  stack: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    gap: "25px",
  },
  confirmButton: {
    backgroundColor: "#080808",
    color: "rgba(255, 255, 255, 1)",
    boxShadow: "0 8px 15px rgba(0, 0, 0, 0.2)",
    position: "relative",
    gap: "10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "44px",
    width: "80%",
    maxWidth: "250px",
    borderRadius: "100px",
    fontWeight: 600,
    fontSize: "14px",
    margin: "10px 0",
    padding: "0 14px",
    minWidth: "60px",
    textAlign: "center",
    cursor: "pointer",
    backdropFilter: "blur(20px) saturate(180%) brightness(115%)",
  },
}));

const useConnectButtonStyles = makeStyles((theme) => ({
  connectButton: {
    backgroundColor: "#bd75f01a",
    textTransform: "none",
    borderRadius: "14px",
    height: "44px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#bd75f0",
    fontFamily: "Inter, sans-serif",
    fontSize: "14px",
    transition: "all 0.2s ease-in-out",
    "&:hover": {
      backgroundColor: "#bd75f033",
    },
  },
}));

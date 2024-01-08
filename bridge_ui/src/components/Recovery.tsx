import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ACALA,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_KARURA,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  getEmitterAddressAlgorand,
  getEmitterAddressEth,
  getEmitterAddressSolana,
  getEmitterAddressTerra,
  hexToNativeAssetString,
  hexToNativeString,
  hexToUint8Array,
  isEVMChain,
  parseSequenceFromLogAlgorand,
  parseSequenceFromLogEth,
  parseSequenceFromLogSolana,
  parseSequenceFromLogTerra,
  uint8ArrayToHex,
  parseTargetChainFromLogEth,
  CHAIN_ID_UNSET,
  TransferToken,
  TransferNFT,
  deserializeTransferTokenVAA,
  deserializeTransferNFTVAA,
} from "@alephium/wormhole-sdk";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Card,
  CircularProgress,
  Container,
  Divider,
  makeStyles,
  TextField,
  Typography,
} from "@material-ui/core";
import { ExpandMore } from "@material-ui/icons";
import { Alert } from "@material-ui/lab";
import { Connection } from "@solana/web3.js";
import { LCDClient } from "@terra-money/terra.js";
import algosdk from "algosdk";
import axios from "axios";
import { ethers } from "ethers";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useHistory, useLocation } from "react-router";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useAcalaRelayerInfo } from "../hooks/useAcalaRelayerInfo";
import useIsWalletReady from "../hooks/useIsWalletReady";
import useRelayersAvailable, { Relayer } from "../hooks/useRelayersAvailable";
import { COLORS } from "../muiTheme";
import { setRecoveryVaa as setRecoveryNFTVaa } from "../store/nftSlice";
import { setRecoveryVaa } from "../store/transferSlice";
import { getAlphTxInfoByTxId } from "../utils/alephium";
import {
  ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  ALGORAND_HOST,
  ALGORAND_TOKEN_BRIDGE_ID,
  CHAINS,
  CHAINS_BY_ID,
  CHAINS_WITH_NFT_SUPPORT,
  getBridgeAddressForChain,
  getNFTBridgeAddressForChain,
  getTokenBridgeAddressForChain,
  RELAY_URL_EXTENSION,
  SOLANA_HOST,
  SOL_NFT_BRIDGE_ADDRESS,
  SOL_TOKEN_BRIDGE_ADDRESS,
  TERRA_HOST,
  TERRA_TOKEN_BRIDGE_ADDRESS,
  WORMHOLE_RPC_HOSTS
} from "../utils/consts";
import { getSignedVAAWithRetry } from "../utils/getSignedVAAWithRetry";
import parseError from "../utils/parseError";
import ButtonWithLoader from "./ButtonWithLoader";
import ChainSelect from "./ChainSelect";
import KeyAndBalance from "./KeyAndBalance";
import RelaySelector from "./RelaySelector";
import { selectTransferSourceChain, selectTransferTransferTx } from "../store/selectors";
import { getEVMCurrentBlockNumber, isEVMTxConfirmed } from "../utils/ethereum";
import { Wallet, useWallet } from "@alephium/web3-react";

const useStyles = makeStyles((theme) => ({
  mainCard: {
    padding: "32px 32px 16px",
    backgroundColor: COLORS.whiteWithTransparency,
  },
  advancedContainer: {
    padding: theme.spacing(2, 0),
  },
  relayAlert: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    "& > .MuiAlert-message": {
      width: "100%",
    },
  },
}));

async function algo(tx: string, enqueueSnackbar: any) {
  try {
    const algodClient = new algosdk.Algodv2(
      ALGORAND_HOST.algodToken,
      ALGORAND_HOST.algodServer,
      ALGORAND_HOST.algodPort
    );
    const pendingInfo = await algodClient
      .pendingTransactionInformation(tx)
      .do();
    let confirmedTxInfo: Record<string, any> | undefined = undefined;
    // This is the code from waitForConfirmation
    if (pendingInfo !== undefined) {
      if (
        pendingInfo["confirmed-round"] !== null &&
        pendingInfo["confirmed-round"] > 0
      ) {
        //Got the completed Transaction
        confirmedTxInfo = pendingInfo;
      }
    }
    if (!confirmedTxInfo) {
      throw new Error("Transaction not found or not confirmed");
    }
    const sequence = parseSequenceFromLogAlgorand(confirmedTxInfo);
    if (!sequence) {
      throw new Error("Sequence not found");
    }
    const emitterAddress = getEmitterAddressAlgorand(ALGORAND_TOKEN_BRIDGE_ID);
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_ALGORAND,
      emitterAddress,
      CHAIN_ID_UNSET,
      sequence,
      WORMHOLE_RPC_HOSTS.length
    );
    return { vaa: uint8ArrayToHex(vaaBytes), error: null };
  } catch (e) {
    console.error(e);
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    return { vaa: null, error: parseError(e) };
  }
}

async function evm(
  provider: ethers.providers.Web3Provider,
  tx: string,
  enqueueSnackbar: any,
  chainId: ChainId,
  nft: boolean
) {
  try {
    const receipt = await provider.getTransactionReceipt(tx);
    const currentBlockNumber = await getEVMCurrentBlockNumber(provider, chainId)
    if (!isEVMTxConfirmed(chainId, receipt.blockNumber, currentBlockNumber)) {
      throw new Error('the transaction is awaiting confirmation')
    }
    const sequence = parseSequenceFromLogEth(
      receipt,
      getBridgeAddressForChain(chainId)
    );
    const targetChain = parseTargetChainFromLogEth(
      receipt,
      getBridgeAddressForChain(chainId)
    )
    const emitterAddress = getEmitterAddressEth(
      nft
        ? getNFTBridgeAddressForChain(chainId)
        : getTokenBridgeAddressForChain(chainId)
    );
    const { vaaBytes } = await getSignedVAAWithRetry(
      chainId,
      emitterAddress,
      targetChain,
      sequence.toString(),
      WORMHOLE_RPC_HOSTS.length
    );
    return { vaa: uint8ArrayToHex(vaaBytes), error: null };
  } catch (e) {
    console.error(e);
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    return { vaa: null, error: parseError(e) };
  }
}

async function solana(tx: string, enqueueSnackbar: any, nft: boolean) {
  try {
    const connection = new Connection(SOLANA_HOST, "confirmed");
    const info = await connection.getTransaction(tx);
    if (!info) {
      throw new Error("An error occurred while fetching the transaction info");
    }
    const sequence = parseSequenceFromLogSolana(info);
    const emitterAddress = await getEmitterAddressSolana(
      nft ? SOL_NFT_BRIDGE_ADDRESS : SOL_TOKEN_BRIDGE_ADDRESS
    );
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_SOLANA,
      emitterAddress,
      CHAIN_ID_UNSET,
      sequence.toString(),
      WORMHOLE_RPC_HOSTS.length
    );
    return { vaa: uint8ArrayToHex(vaaBytes), error: null };
  } catch (e) {
    console.error(e);
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    return { vaa: null, error: parseError(e) };
  }
}

async function terra(tx: string, enqueueSnackbar: any) {
  try {
    const lcd = new LCDClient(TERRA_HOST);
    const info = await lcd.tx.txInfo(tx);
    const sequence = parseSequenceFromLogTerra(info);
    if (!sequence) {
      throw new Error("Sequence not found");
    }
    const emitterAddress = await getEmitterAddressTerra(
      TERRA_TOKEN_BRIDGE_ADDRESS
    );
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_TERRA,
      emitterAddress,
      CHAIN_ID_UNSET,
      sequence,
      WORMHOLE_RPC_HOSTS.length
    );
    return { vaa: uint8ArrayToHex(vaaBytes), error: null };
  } catch (e) {
    console.error(e);
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    return { vaa: null, error: parseError(e) };
  }
}

async function alephium(wallet: Wallet, txId: string, enqueueSnackbar: any) {
  try {
    if (wallet.nodeProvider === undefined) {
      throw new Error('Wallet is not connected')
    }
    const txInfo = await getAlphTxInfoByTxId(wallet.nodeProvider, txId);
    if (txInfo.confirmations < ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL) {
      throw new Error('the transaction is not confirmed')
    }
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_ALEPHIUM,
      ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
      txInfo.targetChain,
      txInfo.sequence,
      WORMHOLE_RPC_HOSTS.length
    );
    return { vaa: uint8ArrayToHex(vaaBytes), error: null };
  } catch (e) {
    console.error(e);
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    return { vaa: null, error: parseError(e) };
  }
}

function RelayerRecovery({
  parsedPayload,
  signedVaa,
  onClick,
}: {
  parsedPayload: any;
  signedVaa: string;
  onClick: () => void;
}) {
  const classes = useStyles();
  const relayerInfo = useRelayersAvailable(true);
  const [selectedRelayer, setSelectedRelayer] = useState<Relayer | null>(null);
  const [isAttemptingToSchedule, setIsAttemptingToSchedule] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  console.log(parsedPayload, relayerInfo, "in recovery relayer");

  const fee =
    (parsedPayload && parsedPayload.fee && parseInt(parsedPayload.fee)) || null;
  //This check is probably more sophisticated in the future. Possibly a net call.
  const isEligible =
    fee &&
    fee > 0 &&
    relayerInfo?.data?.relayers?.length &&
    relayerInfo?.data?.relayers?.length > 0;

  const handleRelayerChange = useCallback(
    (relayer: Relayer | null) => {
      setSelectedRelayer(relayer);
    },
    [setSelectedRelayer]
  );

  const handleGo = useCallback(async () => {
    console.log("handle go", selectedRelayer, parsedPayload);
    if (!(selectedRelayer && selectedRelayer.url)) {
      return;
    }

    setIsAttemptingToSchedule(true);
    axios
      .get(
        selectedRelayer.url +
          RELAY_URL_EXTENSION +
          encodeURIComponent(
            Buffer.from(hexToUint8Array(signedVaa)).toString("base64")
          )
      )
      .then(
        () => {
          setIsAttemptingToSchedule(false);
          onClick();
        },
        (error) => {
          setIsAttemptingToSchedule(false);
          enqueueSnackbar(null, {
            content: (
              <Alert severity="error">
                {"Relay request rejected. Error: " + error.message}
              </Alert>
            ),
          });
        }
      );
  }, [selectedRelayer, enqueueSnackbar, onClick, signedVaa, parsedPayload]);

  if (!isEligible) {
    return null;
  }

  return (
    <Alert variant="outlined" severity="info" className={classes.relayAlert}>
      <Typography>{"This transaction is eligible to be relayed"}</Typography>
      <RelaySelector
        selectedValue={selectedRelayer}
        onChange={handleRelayerChange}
      />
      <ButtonWithLoader
        disabled={!selectedRelayer}
        onClick={handleGo}
        showLoader={isAttemptingToSchedule}
      >
        Request Relay
      </ButtonWithLoader>
    </Alert>
  );
}

function AcalaRelayerRecovery({
  parsedPayload,
  signedVaa,
  onClick,
  isNFT,
}: {
  parsedPayload: any;
  signedVaa: string;
  onClick: () => void;
  isNFT: boolean;
}) {
  const classes = useStyles();
  const originChain: ChainId = parsedPayload?.originChain;
  const originAsset = parsedPayload?.originAddress;
  const targetChain: ChainId = parsedPayload?.targetChain;
  const amount =
    parsedPayload && "amount" in parsedPayload
      ? parsedPayload.amount.toString()
      : "";
  const shouldCheck =
    parsedPayload &&
    originChain &&
    originAsset &&
    signedVaa &&
    targetChain &&
    !isNFT &&
    (targetChain === CHAIN_ID_ACALA || targetChain === CHAIN_ID_KARURA);
  const acalaRelayerInfo = useAcalaRelayerInfo(
    targetChain,
    amount,
    hexToNativeAssetString(originAsset, originChain),
    false
  );
  const enabled = shouldCheck && acalaRelayerInfo.data?.shouldRelay;

  return enabled ? (
    <Alert variant="outlined" severity="info" className={classes.relayAlert}>
      <Typography>
        This transaction is eligible to be relayed by{" "}
        {CHAINS_BY_ID[targetChain].name} &#127881;
      </Typography>
      <ButtonWithLoader onClick={onClick}>Request Relay</ButtonWithLoader>
    </Alert>
  ) : null;
}

export default function Recovery() {
  const classes = useStyles();
  const { push } = useHistory();
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useDispatch();
  const { provider } = useEthereumProvider();
  const isNFT = false
  const transferSourceChain = useSelector(selectTransferSourceChain)
  const transferTx = useSelector(selectTransferTransferTx)
  const [recoverySourceChain, setRecoverySourceChain] =
    useState<ChainId>(CHAIN_ID_ALEPHIUM);
  const [recoverySourceTx, setRecoverySourceTx] = useState("")
  const [recoverySourceTxIsLoading, setRecoverySourceTxIsLoading] =
    useState(false);
  const [recoverySourceTxError, setRecoverySourceTxError] = useState("");
  const [recoverySignedVAA, setRecoverySignedVAA] = useState("");
  const [recoveryParsedVAA, setRecoveryParsedVAA] = useState<any>(null);
  const { isReady, statusMessage } = useIsWalletReady(recoverySourceChain);
  const walletConnectError =
    isEVMChain(recoverySourceChain) && !isReady ? statusMessage : "";
  const parsedPayload = useMemo(() => {
    try {
      return recoveryParsedVAA?.body.payload
        ? recoveryParsedVAA.body.payload
        : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, [recoveryParsedVAA]);

  const { search } = useLocation();
  const query = useMemo(() => new URLSearchParams(search), [search]);
  const pathSourceChain = query.get("sourceChain");
  const pathSourceTransaction = query.get("transactionId");
  const alphWallet = useWallet()

  //This effect initializes the state based on the path params.
  useEffect(() => {
    if (!pathSourceChain) {
      setRecoverySourceChain(transferSourceChain)
    }
    if (!pathSourceTransaction && transferTx !== undefined) {
      setRecoverySourceTx(transferTx.id)
    }
    if (!pathSourceChain && !pathSourceTransaction) {
      return;
    }
    try {
      const sourceChain: ChainId =
        CHAINS_BY_ID[parseFloat(pathSourceChain || "") as ChainId]?.id;

      if (sourceChain) {
        setRecoverySourceChain(sourceChain);
      }
      if (pathSourceTransaction) {
        setRecoverySourceTx(pathSourceTransaction)
      }
    } catch (e) {
      console.error(e);
      console.error("Invalid path params specified.");
    }
  }, [pathSourceChain, pathSourceTransaction, transferSourceChain, transferTx]);

  useEffect(() => {
    if (recoverySourceTx && (!isEVMChain(recoverySourceChain) || isReady)) {
      let cancelled = false;
      if (isEVMChain(recoverySourceChain) && provider) {
        setRecoverySourceTxError("");
        setRecoverySourceTxIsLoading(true);
        (async () => {
          const { vaa, error } = await evm(
            provider,
            recoverySourceTx,
            enqueueSnackbar,
            recoverySourceChain,
            isNFT
          );
          if (!cancelled) {
            setRecoverySourceTxIsLoading(false);
            if (vaa) {
              setRecoverySignedVAA(vaa);
            }
            if (error) {
              setRecoverySourceTxError(error);
            }
          }
        })();
      } else if (recoverySourceChain === CHAIN_ID_SOLANA) {
        setRecoverySourceTxError("");
        setRecoverySourceTxIsLoading(true);
        (async () => {
          const { vaa, error } = await solana(
            recoverySourceTx,
            enqueueSnackbar,
            isNFT
          );
          if (!cancelled) {
            setRecoverySourceTxIsLoading(false);
            if (vaa) {
              setRecoverySignedVAA(vaa);
            }
            if (error) {
              setRecoverySourceTxError(error);
            }
          }
        })();
      } else if (recoverySourceChain === CHAIN_ID_TERRA) {
        setRecoverySourceTxError("");
        setRecoverySourceTxIsLoading(true);
        (async () => {
          const { vaa, error } = await terra(recoverySourceTx, enqueueSnackbar);
          if (!cancelled) {
            setRecoverySourceTxIsLoading(false);
            if (vaa) {
              setRecoverySignedVAA(vaa);
            }
            if (error) {
              setRecoverySourceTxError(error);
            }
          }
        })();
      } else if (recoverySourceChain === CHAIN_ID_ALEPHIUM && isReady) {
        setRecoverySourceTxError("");
        setRecoverySourceTxIsLoading(true);
        (async (nodeProvider) => {
          const { vaa, error } = await alephium(alphWallet, recoverySourceTx, enqueueSnackbar);
          if (!cancelled) {
            setRecoverySourceTxIsLoading(false);
            if (vaa) {
              setRecoverySignedVAA(vaa);
            }
            if (error) {
              setRecoverySourceTxError(error);
            }
          }
        })(alphWallet.nodeProvider);
      } else if (recoverySourceChain === CHAIN_ID_ALGORAND) {
        setRecoverySourceTxError("");
        setRecoverySourceTxIsLoading(true);
        (async () => {
          const { vaa, error } = await algo(recoverySourceTx, enqueueSnackbar);
          if (!cancelled) {
            setRecoverySourceTxIsLoading(false);
            if (vaa) {
              setRecoverySignedVAA(vaa);
            }
            if (error) {
              setRecoverySourceTxError(error);
            }
          }
        })();
      }
      return () => {
        cancelled = true;
      };
    }
  }, [
    recoverySourceChain,
    recoverySourceTx,
    provider,
    enqueueSnackbar,
    isNFT,
    isReady,
    alphWallet
  ]);
  const handleSourceChainChange = useCallback((event: any) => {
    setRecoverySourceTx("");
    setRecoverySourceChain(event.target.value);
  }, []);
  const handleSourceTxChange = useCallback((event: any) => {
    setRecoverySourceTx(event.target.value.trim());
  }, []);
  const handleSignedVAAChange = useCallback((event: any) => {
    setRecoverySignedVAA(event.target.value.trim());
  }, []);
  useEffect(() => {
    let cancelled = false;
    if (recoverySignedVAA) {
      (async () => {
        try {
          const bytes = hexToUint8Array(recoverySignedVAA)
          const parsedVAA = isNFT
            ? deserializeTransferNFTVAA(bytes)
            : deserializeTransferTokenVAA(bytes)
          if (!cancelled) {
            setRecoveryParsedVAA(parsedVAA);
          }
        } catch (e) {
          console.log(e);
          if (!cancelled) {
            setRecoveryParsedVAA(null);
          }
        }
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [recoverySignedVAA, isNFT]);
  const parsedVAATargetChain = recoveryParsedVAA?.body.targetChainId;
  const parsedVAAEmitterChain = recoveryParsedVAA?.body.emitterChainId;
  const enableRecovery = recoverySignedVAA && parsedVAATargetChain;

  const handleRecoverClickBase = useCallback(
    (useRelayer: boolean) => {
      if (enableRecovery && recoverySignedVAA && parsedVAATargetChain && parsedPayload) {
        // TODO: make recovery reducer
        if (isNFT) {
          const payload = parsedPayload as TransferNFT
          dispatch(
            setRecoveryNFTVaa({
              vaa: recoverySignedVAA,
              parsedPayload: {
                targetChain: parsedVAATargetChain,
                targetAddress: uint8ArrayToHex(payload.targetAddress),
                originChain: payload.originChain,
                originAddress: uint8ArrayToHex(payload.originAddress),
              },
            })
          );
          push("/nft");
        } else {
          const payload = parsedPayload as TransferToken
          dispatch(
            setRecoveryVaa({
              vaa: recoverySignedVAA,
              useRelayer,
              parsedPayload: {
                sourceTxId: recoverySourceTx,
                sourceChain: parsedVAAEmitterChain,
                targetChain: parsedVAATargetChain,
                targetAddress: uint8ArrayToHex(payload.targetAddress),
                originChain: payload.originChain,
                originAddress: uint8ArrayToHex(payload.originAddress),
                amount: payload.amount.toString()
              },
            })
          );
          push("/transfer");
        }
      }
    },
    [
      dispatch,
      enableRecovery,
      recoverySourceTx,
      recoverySignedVAA,
      parsedVAATargetChain,
      parsedVAAEmitterChain,
      parsedPayload,
      isNFT,
      push,
    ]
  );

  const handleRecoverClick = useCallback(() => {
    handleRecoverClickBase(false);
  }, [handleRecoverClickBase]);

  const handleRecoverWithRelayerClick = useCallback(() => {
    handleRecoverClickBase(true);
  }, [handleRecoverClickBase]);

  return (
    <Container maxWidth="md">
      <Card className={classes.mainCard}>
        <Alert severity="info" variant="outlined">
          If you have sent your tokens but have not redeemed them, you may paste
          in the Source Transaction ID (from Step 3) to resume your transfer.
        </Alert>
        <ChainSelect
          select
          variant="outlined"
          label="Source Chain"
          disabled={!!recoverySignedVAA}
          value={recoverySourceChain}
          onChange={handleSourceChainChange}
          fullWidth
          margin="normal"
          chains={isNFT ? CHAINS_WITH_NFT_SUPPORT : CHAINS}
        />
        <KeyAndBalance chainId={recoverySourceChain} />
        <TextField
          variant="outlined"
          label="Source Tx (paste here)"
          disabled={
            !!recoverySignedVAA ||
            recoverySourceTxIsLoading ||
            !!walletConnectError
          }
          value={recoverySourceTx}
          onChange={handleSourceTxChange}
          error={!!recoverySourceTxError || !!walletConnectError}
          helperText={recoverySourceTxError || walletConnectError}
          fullWidth
          margin="normal"
        />
        <RelayerRecovery
          parsedPayload={parsedPayload}
          signedVaa={recoverySignedVAA}
          onClick={handleRecoverWithRelayerClick}
        />
        <AcalaRelayerRecovery
          parsedPayload={parsedPayload}
          signedVaa={recoverySignedVAA}
          onClick={handleRecoverWithRelayerClick}
          isNFT={isNFT}
        />
        <ButtonWithLoader
          onClick={handleRecoverClick}
          disabled={!enableRecovery || !isReady}
          showLoader={recoverySourceTxIsLoading}
        >
          Recover
        </ButtonWithLoader>
        <div className={classes.advancedContainer}>
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMore />}>
              Advanced
            </AccordionSummary>
            <AccordionDetails>
              <div>
                <Box position="relative">
                  <TextField
                    variant="outlined"
                    label="Signed VAA (Hex)"
                    disabled={recoverySourceTxIsLoading}
                    value={recoverySignedVAA || ""}
                    onChange={handleSignedVAAChange}
                    fullWidth
                    margin="normal"
                  />
                  {recoverySourceTxIsLoading ? (
                    <Box
                      position="absolute"
                      style={{
                        top: 0,
                        right: 0,
                        left: 0,
                        bottom: 0,
                        backgroundColor: "rgba(0,0,0,0.5)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CircularProgress />
                    </Box>
                  ) : null}
                </Box>
                <Box my={4}>
                  <Divider />
                </Box>
                <TextField
                  variant="outlined"
                  label="Emitter Chain"
                  disabled
                  value={recoveryParsedVAA?.body.emitterChainId || ""}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  variant="outlined"
                  label="Emitter Address"
                  disabled
                  value={
                    (recoveryParsedVAA &&
                      hexToNativeString(
                        recoveryParsedVAA.body.emitterAddress,
                        recoveryParsedVAA.body.emitterChainId
                      )) ||
                    ""
                  }
                  fullWidth
                  margin="normal"
                />
                <TextField
                  variant="outlined"
                  label="Sequence"
                  disabled
                  value={recoveryParsedVAA?.body.sequence.toString() || ""}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  variant="outlined"
                  label="Timestamp"
                  disabled
                  value={
                    (recoveryParsedVAA &&
                      new Date(
                        recoveryParsedVAA.body.timestamp * 1000
                      ).toLocaleString()) ||
                    ""
                  }
                  fullWidth
                  margin="normal"
                />
                <TextField
                  variant="outlined"
                  label="Guardian Set"
                  disabled
                  value={recoveryParsedVAA?.guardianSetIndex.toString() || ""}
                  fullWidth
                  margin="normal"
                />
                <Box my={4}>
                  <Divider />
                </Box>
                <TextField
                  variant="outlined"
                  label="Origin Chain"
                  disabled
                  value={parsedPayload?.originChain.toString() || ""}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  variant="outlined"
                  label="Origin Token Address"
                  disabled
                  value={
                    (parsedPayload &&
                      hexToNativeAssetString(
                        uint8ArrayToHex(parsedPayload.originAddress),
                        parsedPayload.originChain
                      )) ||
                    ""
                  }
                  fullWidth
                  margin="normal"
                />
                {isNFT ? (
                  <TextField
                    variant="outlined"
                    label="Origin Token ID"
                    disabled
                    // @ts-ignore
                    value={parsedPayload?.originAddress || ""}
                    fullWidth
                    margin="normal"
                  />
                ) : null}
                <TextField
                  variant="outlined"
                  label="Target Chain"
                  disabled
                  value={parsedVAATargetChain || ""}
                  fullWidth
                  margin="normal"
                />
                <TextField
                  variant="outlined"
                  label="Target Address"
                  disabled
                  value={
                    (parsedPayload &&
                      hexToNativeString(
                        uint8ArrayToHex(parsedPayload.targetAddress),
                        parsedVAATargetChain
                      )) ||
                    ""
                  }
                  fullWidth
                  margin="normal"
                />
                {isNFT ? null : (
                  <>
                    <TextField
                      variant="outlined"
                      label="Amount"
                      disabled
                      value={
                        parsedPayload && "amount" in parsedPayload
                          ? parsedPayload.amount.toString()
                          : ""
                      }
                      fullWidth
                      margin="normal"
                    />
                    <TextField
                      variant="outlined"
                      label="Relayer Fee"
                      disabled
                      value={
                        parsedPayload && "fee" in parsedPayload
                          ? parsedPayload.fee.toString()
                          : ""
                      }
                      fullWidth
                      margin="normal"
                    />
                  </>
                )}
              </div>
            </AccordionDetails>
          </Accordion>
        </div>
      </Card>
    </Container>
  );
}

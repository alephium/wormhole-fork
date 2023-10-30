import {
  attestFromAlph,
  attestFromAlgorand,
  attestFromSolana,
  attestFromTerra,
  ChainId,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  CHAIN_ID_ALEPHIUM,
  getEmitterAddressAlgorand,
  getEmitterAddressEth,
  getEmitterAddressSolana,
  getEmitterAddressTerra,
  isEVMChain,
  parseSequenceFromLogAlgorand,
  parseSequenceFromLogEth,
  parseSequenceFromLogSolana,
  parseSequenceFromLogTerra,
  uint8ArrayToHex,
  parseTargetChainFromLogEth
} from "@alephium/wormhole-sdk";
import { CHAIN_ID_UNSET } from "@alephium/wormhole-sdk/lib/esm";
import { Alert } from "@material-ui/lab";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  ConnectedWallet,
  useConnectedWallet,
} from "@terra-money/wallet-provider";
import algosdk from "algosdk";
import { Signer } from "ethers";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAlgorandContext } from "../contexts/AlgorandWalletContext";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import {
  setAttestTx,
  setIsSending,
  setIsWalletApproved,
  setSignedVAAHex,
} from "../store/attestSlice";
import {
  selectAttestIsSendComplete,
  selectAttestIsSending,
  selectAttestIsTargetComplete,
  selectAttestSourceAsset,
  selectAttestSourceChain,
  selectTerraFeeDenom,
} from "../store/selectors";
import { getAndCheckLocalTokenInfo, isValidAlephiumTokenId, waitALPHTxConfirmed, waitTxConfirmedAndGetTxInfo } from "../utils/alephium";
import { signSendAndConfirmAlgorand } from "../utils/algorand";
import {
  ALEPHIUM_ATTEST_TOKEN_CONSISTENCY_LEVEL,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  ALEPHIUM_MESSAGE_FEE,
  ALGORAND_BRIDGE_ID,
  ALGORAND_HOST,
  ALGORAND_TOKEN_BRIDGE_ID,
  getBridgeAddressForChain,
  getTokenBridgeAddressForChain,
  SOLANA_HOST,
  SOL_BRIDGE_ADDRESS,
  SOL_TOKEN_BRIDGE_ADDRESS,
  TERRA_TOKEN_BRIDGE_ADDRESS
} from "../utils/consts";
import { getSignedVAAWithRetry } from "../utils/getSignedVAAWithRetry";
import parseError from "../utils/parseError";
import { signSendAndConfirm } from "../utils/solana";
import { postWithFees, waitForTerraExecution } from "../utils/terra";
import { attestFromEthWithoutWait, waitEVMTxConfirmed } from "../utils/ethereum";
import { useWallet, Wallet as AlephiumWallet } from "@alephium/web3-react";

async function algo(
  dispatch: any,
  enqueueSnackbar: any,
  senderAddr: string,
  sourceAsset: string
) {
  dispatch(setIsSending(true));
  try {
    console.log("ALGO", sourceAsset);
    const algodClient = new algosdk.Algodv2(
      ALGORAND_HOST.algodToken,
      ALGORAND_HOST.algodServer,
      ALGORAND_HOST.algodPort
    );
    const txs = await attestFromAlgorand(
      algodClient,
      ALGORAND_TOKEN_BRIDGE_ID,
      ALGORAND_BRIDGE_ID,
      senderAddr,
      BigInt(sourceAsset)
    );
    const result = await signSendAndConfirmAlgorand(algodClient, txs);
    const sequence = parseSequenceFromLogAlgorand(result);
    // TODO: fill these out correctly
    dispatch(
      setAttestTx({
        id: txs[txs.length - 1].tx.txID(),
        blockHeight: result["confirmed-round"],
      })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
    const emitterAddress = getEmitterAddressAlgorand(ALGORAND_TOKEN_BRIDGE_ID);
    enqueueSnackbar(null, {
      content: <Alert severity="info">Fetching VAA</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_ALGORAND,
      emitterAddress,
      CHAIN_ID_UNSET,
      sequence
    );
    dispatch(setSignedVAAHex(uint8ArrayToHex(vaaBytes)));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Fetched Signed VAA</Alert>,
    });
  } catch (e) {
    console.error(e);
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsSending(false));
  }
}

async function evm(
  dispatch: any,
  enqueueSnackbar: any,
  signer: Signer,
  sourceAsset: string,
  chainId: ChainId
) {
  dispatch(setIsSending(true));
  try {
    // Klaytn requires specifying gasPrice
    const overrides =
      chainId === CHAIN_ID_KLAYTN
        ? { gasPrice: (await signer.getGasPrice()).toString() }
        : {};
    const result = await attestFromEthWithoutWait(
      getTokenBridgeAddressForChain(chainId),
      signer,
      sourceAsset,
      overrides
    );
    dispatch(setIsWalletApproved(true))
    const receipt = await result.wait()
    dispatch(
      setAttestTx({ id: receipt.transactionHash, blockHeight: receipt.blockNumber })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
    const sequence = parseSequenceFromLogEth(
      receipt,
      getBridgeAddressForChain(chainId)
    );
    const targetChain = parseTargetChainFromLogEth(
      receipt,
      getBridgeAddressForChain(chainId)
    )
    const emitterAddress = getEmitterAddressEth(
      getTokenBridgeAddressForChain(chainId)
    );
    if (signer.provider) {
      await waitEVMTxConfirmed(signer.provider, receipt, chainId)
    }
    enqueueSnackbar(null, {
      content: <Alert severity="info">Fetching VAA</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      chainId,
      emitterAddress,
      targetChain,
      sequence
    );
    dispatch(setSignedVAAHex(uint8ArrayToHex(vaaBytes)));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Fetched Signed VAA</Alert>,
    });
  } catch (e) {
    console.error(e);
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsSending(false));
  }
}

async function solana(
  dispatch: any,
  enqueueSnackbar: any,
  solPK: PublicKey,
  sourceAsset: string,
  wallet: WalletContextState
) {
  dispatch(setIsSending(true));
  try {
    const connection = new Connection(SOLANA_HOST, "confirmed");
    const transaction = await attestFromSolana(
      connection,
      SOL_BRIDGE_ADDRESS,
      SOL_TOKEN_BRIDGE_ADDRESS,
      solPK.toString(),
      sourceAsset
    );
    const txid = await signSendAndConfirm(wallet, connection, transaction);
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
    const info = await connection.getTransaction(txid);
    if (!info) {
      // TODO: error state
      throw new Error("An error occurred while fetching the transaction info");
    }
    dispatch(setAttestTx({ id: txid, blockHeight: info.slot }));
    const sequence = parseSequenceFromLogSolana(info);
    const emitterAddress = await getEmitterAddressSolana(
      SOL_TOKEN_BRIDGE_ADDRESS
    );
    enqueueSnackbar(null, {
      content: <Alert severity="info">Fetching VAA</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_SOLANA,
      emitterAddress,
      CHAIN_ID_UNSET,
      sequence
    );
    dispatch(setSignedVAAHex(uint8ArrayToHex(vaaBytes)));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Fetched Signed VAA</Alert>,
    });
  } catch (e) {
    console.error(e);
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsSending(false));
  }
}

async function terra(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: ConnectedWallet,
  asset: string,
  feeDenom: string
) {
  dispatch(setIsSending(true));
  try {
    const msg = await attestFromTerra(
      TERRA_TOKEN_BRIDGE_ADDRESS,
      wallet.terraAddress,
      asset
    );
    const result = await postWithFees(wallet, [msg], "Create Wrapped", [
      feeDenom,
    ]);
    const info = await waitForTerraExecution(result);
    dispatch(setAttestTx({ id: info.txhash, blockHeight: info.height }));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
    const sequence = parseSequenceFromLogTerra(info);
    if (!sequence) {
      throw new Error("Sequence not found");
    }
    const emitterAddress = await getEmitterAddressTerra(
      TERRA_TOKEN_BRIDGE_ADDRESS
    );
    enqueueSnackbar(null, {
      content: <Alert severity="info">Fetching VAA</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_TERRA,
      emitterAddress,
      CHAIN_ID_UNSET,
      sequence
    );
    dispatch(setSignedVAAHex(uint8ArrayToHex(vaaBytes)));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Fetched Signed VAA</Alert>,
    });
  } catch (e) {
    console.error(e);
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsSending(false));
  }
}

async function alephium(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: AlephiumWallet,
  localTokenId: string
) {
  if (wallet.nodeProvider === undefined) {
    return
  }
  dispatch(setIsSending(true));
  try {
    if (!isValidAlephiumTokenId(localTokenId)) {
      throw new Error(`Invalid local token: ${localTokenId}`)
    }
    const tokenInfo = await getAndCheckLocalTokenInfo(wallet.nodeProvider, localTokenId)
    const result = await attestFromAlph(
      wallet.signer,
      ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
      localTokenId,
      tokenInfo.decimals,
      tokenInfo.symbol,
      tokenInfo.name,
      wallet.account.address,
      ALEPHIUM_MESSAGE_FEE,
      ALEPHIUM_ATTEST_TOKEN_CONSISTENCY_LEVEL
    )
    dispatch(setIsWalletApproved(true))
    const txInfo = await waitTxConfirmedAndGetTxInfo(wallet.nodeProvider, result.txId);
    dispatch(setAttestTx({ id: txInfo.txId, blockHeight: txInfo.blockHeight, blockTimestamp: txInfo.blockTimestamp }));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
    await waitALPHTxConfirmed(wallet.nodeProvider, txInfo.txId, ALEPHIUM_ATTEST_TOKEN_CONSISTENCY_LEVEL)
    enqueueSnackbar(null, {
      content: <Alert severity="info">Fetching VAA</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_ALEPHIUM,
      ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
      txInfo.targetChain,
      txInfo.sequence
    );
    dispatch(setSignedVAAHex(uint8ArrayToHex(vaaBytes)));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Fetched Signed VAA</Alert>,
    });
  } catch (e) {
    console.error(e);
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsSending(false));
  }
}

export function useHandleAttest() {
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const sourceChain = useSelector(selectAttestSourceChain);
  const sourceAsset = useSelector(selectAttestSourceAsset);
  const isTargetComplete = useSelector(selectAttestIsTargetComplete);
  const isSending = useSelector(selectAttestIsSending);
  const isSendComplete = useSelector(selectAttestIsSendComplete);
  const { signer } = useEthereumProvider();
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const terraWallet = useConnectedWallet();
  const terraFeeDenom = useSelector(selectTerraFeeDenom);
  const alphWallet = useWallet();
  const { accounts: algoAccounts } = useAlgorandContext();
  const disabled = !isTargetComplete || isSending || isSendComplete;
  const handleAttestClick = useCallback(() => {
    if (isEVMChain(sourceChain) && !!signer) {
      evm(dispatch, enqueueSnackbar, signer, sourceAsset, sourceChain);
    } else if (sourceChain === CHAIN_ID_SOLANA && !!solanaWallet && !!solPK) {
      solana(dispatch, enqueueSnackbar, solPK, sourceAsset, solanaWallet);
    } else if (sourceChain === CHAIN_ID_TERRA && !!terraWallet) {
      terra(dispatch, enqueueSnackbar, terraWallet, sourceAsset, terraFeeDenom);
    } else if (sourceChain === CHAIN_ID_ALEPHIUM && !!alphWallet) {
      alephium(dispatch, enqueueSnackbar, alphWallet, sourceAsset)
    } else if (sourceChain === CHAIN_ID_ALGORAND && algoAccounts[0]) {
      algo(dispatch, enqueueSnackbar, algoAccounts[0].address, sourceAsset);
    } else {
    }
  }, [
    dispatch,
    enqueueSnackbar,
    sourceChain,
    signer,
    solanaWallet,
    solPK,
    terraWallet,
    alphWallet,
    sourceAsset,
    terraFeeDenom,
    algoAccounts,
  ]);
  return useMemo(
    () => ({
      handleClick: handleAttestClick,
      disabled,
      showLoader: isSending,
    }),
    [handleAttestClick, disabled, isSending]
  );
}

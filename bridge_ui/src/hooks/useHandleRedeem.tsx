import {
  ChainId,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  isEVMChain,
  redeemAndUnwrapOnSolana,
  redeemOnAlgorand,
  redeemOnSolana,
  redeemOnTerra,
  CHAIN_ID_ALEPHIUM,
  uint8ArrayToHex,
  getTokenBridgeForChainId,
  getIsTransferCompletedAlph,
  redeemOnAlphWithReward,
  deserializeVAA
} from "@alephium/wormhole-sdk";
import { Alert } from "@material-ui/lab";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import {
  ConnectedWallet,
  useConnectedWallet,
} from "@terra-money/wallet-provider";
import algosdk from "algosdk";
import axios from "axios";
import { Signer } from "ethers";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAlgorandContext } from "../contexts/AlgorandWalletContext";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import {
  selectTerraFeeDenom,
  selectTransferIsRedeeming,
  selectTransferRecoverySourceTxId,
  selectTransferSourceChain,
  selectTransferTargetChain,
} from "../store/selectors";
import { setIsRedeeming, setIsRedeemingViaRelayer, setIsWalletApproved, setRedeemCompleted, setRedeemTx } from "../store/transferSlice";
import { signSendAndConfirmAlgorand } from "../utils/algorand";
import {
  ACALA_RELAY_URL,
  ALEPHIUM_BRIDGE_GROUP_INDEX,
  ALEPHIUM_BRIDGE_REWARD_ROUTER_ID,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  ALGORAND_BRIDGE_ID,
  ALGORAND_HOST,
  ALGORAND_TOKEN_BRIDGE_ID,
  getTokenBridgeAddressForChain,
  MAX_VAA_UPLOAD_RETRIES_SOLANA,
  SOLANA_HOST,
  SOL_BRIDGE_ADDRESS,
  SOL_TOKEN_BRIDGE_ADDRESS,
  TERRA_TOKEN_BRIDGE_ADDRESS,
  CLUSTER,
  RELAYER_HOST,
} from "../utils/consts";
import parseError from "../utils/parseError";
import { postVaaWithRetry } from "../utils/postVaa";
import { signSendAndConfirm } from "../utils/solana";
import { postWithFees } from "../utils/terra";
import { getEmitterChainId, waitALPHTxConfirmed } from "../utils/alephium";
import useTransferSignedVAA from "./useTransferSignedVAA";
import { redeemOnEthNativeWithoutWait, redeemOnEthWithoutWait } from "../utils/ethereum";
import { useWallet, Wallet as AlephiumWallet } from "@alephium/web3-react";
import { SignerProvider } from "@alephium/web3";

async function algo(
  dispatch: any,
  enqueueSnackbar: any,
  senderAddr: string,
  signedVAA: Uint8Array
) {
  dispatch(setIsRedeeming(true));
  try {
    const algodClient = new algosdk.Algodv2(
      ALGORAND_HOST.algodToken,
      ALGORAND_HOST.algodServer,
      ALGORAND_HOST.algodPort
    );
    const txs = await redeemOnAlgorand(
      algodClient,
      ALGORAND_TOKEN_BRIDGE_ID,
      ALGORAND_BRIDGE_ID,
      signedVAA,
      senderAddr
    );
    const result = await signSendAndConfirmAlgorand(algodClient, txs);
    // TODO: fill these out correctly
    dispatch(
      setRedeemTx({
        id: txs[txs.length - 1].tx.txID(),
        blockHeight: result["confirmed-round"],
      })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsRedeeming(false));
  }
}

async function evm(
  dispatch: any,
  enqueueSnackbar: any,
  signer: Signer,
  signedVAA: Uint8Array,
  isNative: boolean,
  targetChainId: ChainId,
  sourceChainId: ChainId,
  sourceTxId: string | undefined
) {
  dispatch(setIsRedeeming(true));
  try {
    // Klaytn requires specifying gasPrice
    const overrides =
      targetChainId === CHAIN_ID_KLAYTN
        ? { gasPrice: (await signer.getGasPrice()).toString() }
        : {};
    const result = isNative
      ? await redeemOnEthNativeWithoutWait(
          getTokenBridgeAddressForChain(targetChainId),
          signer,
          signedVAA,
          overrides
        )
      : await redeemOnEthWithoutWait(
          getTokenBridgeAddressForChain(targetChainId),
          signer,
          signedVAA,
          overrides
        );
    dispatch(setIsWalletApproved(true))
    const receipt = await result.wait()
    dispatch(
      setRedeemTx({ id: receipt.transactionHash, blockHeight: receipt.blockNumber })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsRedeeming(false));
  }
}

async function solana(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: WalletContextState,
  payerAddress: string, //TODO: we may not need this since we have wallet
  signedVAA: Uint8Array,
  isNative: boolean
) {
  dispatch(setIsRedeeming(true));
  try {
    if (!wallet.signTransaction) {
      throw new Error("wallet.signTransaction is undefined");
    }
    const connection = new Connection(SOLANA_HOST, "confirmed");
    await postVaaWithRetry(
      connection,
      wallet.signTransaction,
      SOL_BRIDGE_ADDRESS,
      payerAddress,
      Buffer.from(signedVAA),
      MAX_VAA_UPLOAD_RETRIES_SOLANA
    );
    // TODO: how do we retry in between these steps
    const transaction = isNative
      ? await redeemAndUnwrapOnSolana(
          connection,
          SOL_BRIDGE_ADDRESS,
          SOL_TOKEN_BRIDGE_ADDRESS,
          payerAddress,
          signedVAA
        )
      : await redeemOnSolana(
          connection,
          SOL_BRIDGE_ADDRESS,
          SOL_TOKEN_BRIDGE_ADDRESS,
          payerAddress,
          signedVAA
        );
    const txid = await signSendAndConfirm(wallet, connection, transaction);
    // TODO: didn't want to make an info call we didn't need, can we get the block without it by modifying the above call?
    dispatch(setRedeemTx({ id: txid, blockHeight: 1 }));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsRedeeming(false));
  }
}

async function terra(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: ConnectedWallet,
  signedVAA: Uint8Array,
  feeDenom: string
) {
  dispatch(setIsRedeeming(true));
  try {
    const msg = await redeemOnTerra(
      TERRA_TOKEN_BRIDGE_ADDRESS,
      wallet.terraAddress,
      signedVAA
    );
    const result = await postWithFees(
      wallet,
      [msg],
      "Wormhole - Complete Transfer",
      [feeDenom]
    );
    dispatch(
      setRedeemTx({ id: result.result.txhash, blockHeight: result.result.height })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsRedeeming(false));
  }
}

async function redeemViaRelayer(
  dispatch: any,
  signer: SignerProvider,
  tokenBridgeForChainId: string,
  signedVAA: Uint8Array
): Promise<string | undefined> {
  try {
    dispatch(setIsRedeemingViaRelayer(true))
    const parsedVAA = deserializeVAA(signedVAA)
    const emitterChain = parsedVAA.body.emitterChainId.toString()
    const targetChain = parsedVAA.body.targetChainId.toString()
    const emitterAddress = uint8ArrayToHex(parsedVAA.body.emitterAddress)
    const sequence = parsedVAA.body.sequence.toString()
    const url = `${RELAYER_HOST}/vaas/${emitterChain}/${emitterAddress}/${targetChain}/${sequence}`
    const { data } = await axios.request({ url, method: 'POST', timeout: 15000 })
    if (data.error) {
      throw new Error(data.error)
    }
    dispatch(setIsWalletApproved(true))
    dispatch(setIsRedeemingViaRelayer(false))
    return data.txId ? data.txId as string : undefined
  } catch (error) {
    dispatch(setIsRedeemingViaRelayer(false))
    console.error(`failed to redeem via relayer, error: ${error}`)
    return await redeemManually(dispatch, signer, tokenBridgeForChainId, signedVAA)
  }
}

async function redeemManually(
  dispatch: any,
  signer: SignerProvider,
  tokenBridgeForChainId: string,
  signedVAA: Uint8Array
): Promise<string> {
  const result = await redeemOnAlphWithReward(signer, ALEPHIUM_BRIDGE_REWARD_ROUTER_ID, tokenBridgeForChainId, signedVAA)
  console.log(`the redemption tx has been submitted, txId: ${result.txId}`)
  dispatch(setIsWalletApproved(true))
  return result.txId
}

async function alephium(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: AlephiumWallet,
  signedVAA: Uint8Array
) {
  if (wallet.nodeProvider === undefined) {
    return
  }
  dispatch(setIsRedeeming(true));
  try {
    const emitterChainId = getEmitterChainId(signedVAA)
    const tokenBridgeForChainId = getTokenBridgeForChainId(ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID, emitterChainId, ALEPHIUM_BRIDGE_GROUP_INDEX)

    let txId: string | undefined = undefined
    if (CLUSTER === 'mainnet') {
      txId = await redeemViaRelayer(dispatch, wallet.signer, tokenBridgeForChainId, signedVAA)
    } else {
      txId = await redeemManually(dispatch, wallet.signer, tokenBridgeForChainId, signedVAA)
    }

    if (txId === undefined) {
      dispatch(setRedeemCompleted())
      enqueueSnackbar(null, {
        content: <Alert severity="success">Transaction confirmed</Alert>,
      });
      return
    }

    const confirmedTx = await waitALPHTxConfirmed(wallet.nodeProvider, txId, 1)
    const blockHeader = await wallet.nodeProvider.blockflow.getBlockflowHeadersBlockHash(confirmedTx.blockHash)
    dispatch(
      setRedeemTx({ id: txId, blockHeight: blockHeader.height })
    );
    console.log(`the redeem tx has been confirmed, txId: ${txId}`)
    const isTransferCompleted = await getIsTransferCompletedAlph(
      tokenBridgeForChainId,
      ALEPHIUM_BRIDGE_GROUP_INDEX,
      signedVAA
    )
    if (isTransferCompleted) {
      enqueueSnackbar(null, {
        content: <Alert severity="success">Transaction confirmed</Alert>,
      });
    } else {
      enqueueSnackbar(null, {
        content: <Alert severity="error">Transfer failed, please try again later</Alert>,
      });
    }

  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsRedeeming(false));
  }
}

export function useHandleRedeem() {
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const targetChain = useSelector(selectTransferTargetChain);
  const sourceChain = useSelector(selectTransferSourceChain);
  const recoverySourceTxId = useSelector(selectTransferRecoverySourceTxId);
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const { signer } = useEthereumProvider();
  const terraWallet = useConnectedWallet();
  const terraFeeDenom = useSelector(selectTerraFeeDenom);
  const alphWallet = useWallet();
  const { accounts: algoAccounts } = useAlgorandContext();
  const signedVAA = useTransferSignedVAA();
  const isRedeeming = useSelector(selectTransferIsRedeeming);
  const handleRedeemClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && signedVAA) {
      evm(dispatch, enqueueSnackbar, signer, signedVAA, false, targetChain, sourceChain, recoverySourceTxId);
    } else if (
      targetChain === CHAIN_ID_SOLANA &&
      !!solanaWallet &&
      !!solPK &&
      signedVAA
    ) {
      solana(
        dispatch,
        enqueueSnackbar,
        solanaWallet,
        solPK.toString(),
        signedVAA,
        false
      );
    } else if (targetChain === CHAIN_ID_TERRA && !!terraWallet && signedVAA) {
      terra(dispatch, enqueueSnackbar, terraWallet, signedVAA, terraFeeDenom);
    } else if (targetChain === CHAIN_ID_ALEPHIUM && !!alphWallet && signedVAA) {
      alephium(dispatch, enqueueSnackbar, alphWallet, signedVAA)
    } else if (
      targetChain === CHAIN_ID_ALGORAND &&
      algoAccounts[0] &&
      !!signedVAA
    ) {
      algo(dispatch, enqueueSnackbar, algoAccounts[0]?.address, signedVAA);
    } else {
    }
  }, [
    dispatch,
    enqueueSnackbar,
    sourceChain,
    recoverySourceTxId,
    targetChain,
    signer,
    signedVAA,
    solanaWallet,
    solPK,
    terraWallet,
    terraFeeDenom,
    alphWallet,
    algoAccounts,
  ]);

  const handleRedeemNativeClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && signedVAA) {
      evm(dispatch, enqueueSnackbar, signer, signedVAA, true, targetChain, sourceChain, recoverySourceTxId);
    } else if (
      targetChain === CHAIN_ID_SOLANA &&
      !!solanaWallet &&
      !!solPK &&
      signedVAA
    ) {
      solana(
        dispatch,
        enqueueSnackbar,
        solanaWallet,
        solPK.toString(),
        signedVAA,
        true
      );
    } else if (targetChain === CHAIN_ID_TERRA && !!terraWallet && signedVAA) {
      terra(dispatch, enqueueSnackbar, terraWallet, signedVAA, terraFeeDenom); //TODO isNative = true
    } else if (
      targetChain === CHAIN_ID_ALGORAND &&
      algoAccounts[0] &&
      !!signedVAA
    ) {
      algo(dispatch, enqueueSnackbar, algoAccounts[0]?.address, signedVAA);
    } else {
    }
  }, [
    dispatch,
    enqueueSnackbar,
    targetChain,
    sourceChain,
    recoverySourceTxId,
    signer,
    signedVAA,
    solanaWallet,
    solPK,
    terraWallet,
    terraFeeDenom,
    algoAccounts,
  ]);

  const handleAcalaRelayerRedeemClick = useCallback(async () => {
    if (!signedVAA) return;

    dispatch(setIsRedeeming(true));

    try {
      const res = await axios.post(ACALA_RELAY_URL, {
        targetChain,
        signedVAA: uint8ArrayToHex(signedVAA),
      });

      dispatch(
        setRedeemTx({
          id: res.data.transactionHash,
          blockHeight: res.data.blockNumber,
        })
      );
      enqueueSnackbar(null, {
        content: <Alert severity="success">Transaction confirmed</Alert>,
      });
    } catch (e) {
      enqueueSnackbar(null, {
        content: <Alert severity="error">{parseError(e)}</Alert>,
      });
      dispatch(setIsRedeeming(false));
    }
  }, [targetChain, signedVAA, enqueueSnackbar, dispatch]);

  return useMemo(
    () => ({
      handleNativeClick: handleRedeemNativeClick,
      handleClick: handleRedeemClick,
      handleAcalaRelayerRedeemClick,
      disabled: !!isRedeeming,
      showLoader: !!isRedeeming,
    }),
    [
      handleRedeemClick,
      isRedeeming,
      handleRedeemNativeClick,
      handleAcalaRelayerRedeemClick,
    ]
  );
}

import {
  ChainId,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  isEVMChain,
  postVaaSolanaWithRetry,
  redeemAndUnwrapOnSolana,
  redeemOnEth,
  redeemOnEthNative,
  redeemOnSolana,
  redeemOnTerra,
  redeemOnAlph,
  CHAIN_ID_ALEPHIUM,
} from "@certusone/wormhole-sdk";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import {
  ConnectedWallet,
  useConnectedWallet,
} from "@terra-money/wallet-provider";
import { Signer } from "ethers";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import useTransferSignedVAA from "./useTransferSignedVAA";
import {
  selectTerraFeeDenom,
  selectTransferIsRedeeming,
  selectTransferTargetChain,
} from "../store/selectors";
import { setIsRedeeming, setRedeemTx } from "../store/transferSlice";
import {
  getTokenBridgeAddressForChain,
  MAX_VAA_UPLOAD_RETRIES_SOLANA,
  SOLANA_HOST,
  SOL_BRIDGE_ADDRESS,
  SOL_TOKEN_BRIDGE_ADDRESS,
  TERRA_TOKEN_BRIDGE_ADDRESS,
} from "../utils/consts";
import parseError from "../utils/parseError";
import { signSendAndConfirm } from "../utils/solana";
import { Alert } from "@material-ui/lab";
import { postWithFees } from "../utils/terra";
import {
  getAlphConfirmedTxInfo,
  getRedeemInfo,
  getLocalTokenWrapperIdWithRetry,
  getRemoteTokenWrapperIdWithRetry
} from "../utils/alephium";
import { AlephiumWallet, useAlephiumWallet } from "../contexts/AlephiumWalletContext";

async function evm(
  dispatch: any,
  enqueueSnackbar: any,
  signer: Signer,
  signedVAA: Uint8Array,
  isNative: boolean,
  chainId: ChainId
) {
  dispatch(setIsRedeeming(true));
  try {
    const receipt = isNative
      ? await redeemOnEthNative(
          getTokenBridgeAddressForChain(chainId),
          signer,
          signedVAA
        )
      : await redeemOnEth(
          getTokenBridgeAddressForChain(chainId),
          signer,
          signedVAA
        );
    dispatch(
      setRedeemTx({ id: receipt.transactionHash, block: receipt.blockNumber })
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
    await postVaaSolanaWithRetry(
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
    dispatch(setRedeemTx({ id: txid, block: 1 }));
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
      setRedeemTx({ id: result.result.txhash, block: result.result.height })
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

async function alephium(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: AlephiumWallet,
  signedVAA: Uint8Array
) {
  dispatch(setIsRedeeming(true));
  try {
    const redeemInfo = getRedeemInfo(signedVAA)
    let tokenWrapperId: string
    if (redeemInfo.tokenChainId === CHAIN_ID_ALEPHIUM) {
      tokenWrapperId = await getLocalTokenWrapperIdWithRetry(redeemInfo.tokenId, redeemInfo.remoteChainId)
    } else {
      tokenWrapperId = await getRemoteTokenWrapperIdWithRetry(redeemInfo.tokenId)
    }
    const result = await redeemOnAlph(wallet.signer, tokenWrapperId, signedVAA, wallet.address)
    const txInfo = await getAlphConfirmedTxInfo(wallet.signer.client, result.txId)
    dispatch(
      setRedeemTx({ id: result.txId, block: txInfo.blockHeight })
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

export function useHandleRedeem() {
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const targetChain = useSelector(selectTransferTargetChain);
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const { signer } = useEthereumProvider();
  const terraWallet = useConnectedWallet();
  const terraFeeDenom = useSelector(selectTerraFeeDenom);
  const alephiumWallet = useAlephiumWallet();
  const signedVAA = useTransferSignedVAA();
  const isRedeeming = useSelector(selectTransferIsRedeeming);
  const handleRedeemClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && signedVAA) {
      evm(dispatch, enqueueSnackbar, signer, signedVAA, false, targetChain);
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
    } else if (targetChain === CHAIN_ID_ALEPHIUM && !!alephiumWallet && signedVAA) {
      alephium(dispatch, enqueueSnackbar, alephiumWallet, signedVAA)
    }
  }, [
    dispatch,
    enqueueSnackbar,
    targetChain,
    signer,
    signedVAA,
    solanaWallet,
    solPK,
    terraWallet,
    terraFeeDenom,
    alephiumWallet
  ]);

  const handleRedeemNativeClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && signedVAA) {
      evm(dispatch, enqueueSnackbar, signer, signedVAA, true, targetChain);
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
    } else {
    }
  }, [
    dispatch,
    enqueueSnackbar,
    targetChain,
    signer,
    signedVAA,
    solanaWallet,
    solPK,
    terraWallet,
    terraFeeDenom,
  ]);

  return useMemo(
    () => ({
      handleNativeClick: handleRedeemNativeClick,
      handleClick: handleRedeemClick,
      disabled: !!isRedeeming,
      showLoader: !!isRedeeming,
    }),
    [handleRedeemClick, isRedeeming, handleRedeemNativeClick]
  );
}

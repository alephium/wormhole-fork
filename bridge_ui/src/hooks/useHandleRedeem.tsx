import {
  ChainId,
  CHAIN_ID_TERRA,
  isEVMChain,
  redeemOnEth,
  redeemOnEthNative,
  redeemOnTerra,
  redeemOnAlph,
  CHAIN_ID_ALEPHIUM,
} from "@certusone/wormhole-sdk";
import {
  ConnectedWallet,
  useConnectedWallet,
} from "@terra-money/wallet-provider";
import { Signer } from "ethers";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import useTransferSignedVAA from "./useTransferSignedVAA";
import {
  selectTerraFeeDenom,
  selectTransferIsRedeeming,
  selectTransferTargetChain,
} from "../store/selectors";
import { setIsRedeeming, setRedeemTx } from "../store/transferSlice";
import {
  getTokenBridgeAddressForChain,
  TERRA_TOKEN_BRIDGE_ADDRESS,
} from "../utils/consts";
import parseError from "../utils/parseError";
import { Alert } from "@material-ui/lab";
import { postWithFees } from "../utils/terra";
import {
  getRedeemInfo,
  getLocalTokenWrapperIdWithRetry,
  getRemoteTokenWrapperIdWithRetry,
  waitTxConfirmed,
  submitAlphScriptTx
} from "../utils/alephium";
import { AlephiumWalletSigner, useAlephiumWallet } from "../contexts/AlephiumWalletContext";

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
  signer: AlephiumWalletSigner,
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
    const bytecode = redeemOnAlph(tokenWrapperId, signedVAA, signer.account.address)
    const result = await submitAlphScriptTx(signer.provider, signer.account.address, bytecode)
    const confirmedTx = await waitTxConfirmed(signer.client, result.txId)
    const blockHeader = await signer.client.blockflow.getBlockflowHeadersBlockHash(confirmedTx.blockHash)
    dispatch(
      setRedeemTx({ id: result.txId, block: blockHeader.data.height })
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
  const { signer } = useEthereumProvider();
  const terraWallet = useConnectedWallet();
  const terraFeeDenom = useSelector(selectTerraFeeDenom);
  const { signer: alphSigner } = useAlephiumWallet();
  const signedVAA = useTransferSignedVAA();
  const isRedeeming = useSelector(selectTransferIsRedeeming);
  const handleRedeemClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && signedVAA) {
      evm(dispatch, enqueueSnackbar, signer, signedVAA, false, targetChain);
    } else if (targetChain === CHAIN_ID_TERRA && !!terraWallet && signedVAA) {
      terra(dispatch, enqueueSnackbar, terraWallet, signedVAA, terraFeeDenom);
    } else if (targetChain === CHAIN_ID_ALEPHIUM && !!alphSigner && signedVAA) {
      alephium(dispatch, enqueueSnackbar, alphSigner, signedVAA)
    }
  }, [
    dispatch,
    enqueueSnackbar,
    targetChain,
    signer,
    signedVAA,
    terraWallet,
    terraFeeDenom,
    alphSigner
  ]);

  const handleRedeemNativeClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && signedVAA) {
      evm(dispatch, enqueueSnackbar, signer, signedVAA, true, targetChain);
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

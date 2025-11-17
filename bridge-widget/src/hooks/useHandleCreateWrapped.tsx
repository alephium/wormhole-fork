import {
  ChainId,
  CHAIN_ID_ACALA,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_ALEPHIUM,
  isEVMChain,
  createRemoteTokenPoolOnAlph,
  updateRemoteTokenPoolOnAlph,
  getAttestTokenHandlerId,
  updateWrappedOnEth,
  createWrappedOnEth
} from "@alephium/wormhole-sdk";
import { Alert } from "@mui/material";
import { Signer } from "ethers";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { setCreateTx, setIsCreating, setIsWalletApproved } from "../store/attestSlice";
import {
  selectAttestIsCreating,
  selectAttestSourceChain,
  selectAttestTargetChain
} from "../store/selectors";
import {
  getTokenBridgeAddressForChain,
  getConst
} from "../utils/consts";
import { getKaruraGasParams } from "../utils/karura";
import parseError from "../utils/parseError";
import { waitALPHTxConfirmed } from "../utils/alephium";
import useAttestSignedVAA from "./useAttestSignedVAA";
import { useWallet, Wallet as AlephiumWallet } from "@alephium/web3-react";
import { MINIMAL_CONTRACT_DEPOSIT } from "@alephium/web3";
import i18n from "../i18n";

async function evm(
  dispatch: any,
  enqueueSnackbar: any,
  signer: Signer,
  signedVAA: Uint8Array,
  chainId: ChainId,
  shouldUpdate: boolean
) {
  dispatch(setIsCreating(true));
  try {
    // Karura and Acala need gas params for contract deploys
    // Klaytn requires specifying gasPrice
    const overrides =
      chainId === CHAIN_ID_KARURA
        ? await getKaruraGasParams(getConst('KARURA_HOST'))
        : chainId === CHAIN_ID_ACALA
        ? await getKaruraGasParams(getConst('ACALA_HOST'))
        : chainId === CHAIN_ID_KLAYTN
        ? { gasPrice: (await signer.getGasPrice()).toString() }
        : {};
    const result = shouldUpdate
      ? await updateWrappedOnEth(
          getTokenBridgeAddressForChain(chainId),
          signer,
          signedVAA,
          overrides
        )
      : await createWrappedOnEth(
          getTokenBridgeAddressForChain(chainId),
          signer,
          signedVAA,
          overrides
        );
    dispatch(setIsWalletApproved(true))
    const receipt = await result.wait()
    dispatch(
      setCreateTx({ id: receipt.transactionHash, blockHeight: receipt.blockNumber })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsCreating(false));
  }
}

async function alephium(
  dispatch: any,
  enqueueSnackbar: any,
  sourceChain: ChainId,
  wallet: AlephiumWallet,
  signedVAA: Uint8Array,
  shouldUpdate: boolean
) {
  if (wallet.nodeProvider === undefined) {
    return
  }
  dispatch(setIsCreating(true));
  try {
    const attestTokenHandlerId = getAttestTokenHandlerId(getConst('ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID'), sourceChain, getConst('ALEPHIUM_BRIDGE_GROUP_INDEX'))
    const result = shouldUpdate
      ? await updateRemoteTokenPoolOnAlph(wallet.signer, attestTokenHandlerId, signedVAA)
      : await createRemoteTokenPoolOnAlph(wallet.signer, attestTokenHandlerId, signedVAA, wallet.account.address, MINIMAL_CONTRACT_DEPOSIT)
    dispatch(setIsWalletApproved(true))
    const confirmedTx = await waitALPHTxConfirmed(wallet.nodeProvider, result.txId, 1)
    const blockHeader = await wallet.nodeProvider.blockflow.getBlockflowHeadersBlockHash(confirmedTx.blockHash)
    dispatch(
      setCreateTx({ id: result.txId, blockHeight: blockHeader.height })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsCreating(false));
  }
}

export function useHandleCreateWrapped(shouldUpdate: boolean) {
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const sourceChain = useSelector(selectAttestSourceChain);
  const targetChain = useSelector(selectAttestTargetChain);
  const signedVAA = useAttestSignedVAA();
  const isCreating = useSelector(selectAttestIsCreating);
  const { signer } = useEthereumProvider();
  const alphWallet = useWallet();
  const handleCreateClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && !!signedVAA) {
      evm(
        dispatch,
        enqueueSnackbar,
        signer,
        signedVAA,
        targetChain,
        shouldUpdate
      );
    } else if (targetChain === CHAIN_ID_ALEPHIUM && !!alphWallet && !!signedVAA) {
      alephium(
        dispatch,
        enqueueSnackbar,
        sourceChain,
        alphWallet,
        signedVAA,
        shouldUpdate
      )
    } else {
      // enqueueSnackbar(
      //   "Creating wrapped tokens on this chain is not yet supported",
      //   {
      //     variant: "error",
      //   }
      // );
    }
  }, [
    dispatch,
    enqueueSnackbar,
    sourceChain,
    targetChain,
    alphWallet,
    signedVAA,
    signer,
    shouldUpdate
  ]);
  return useMemo(
    () => ({
      handleClick: handleCreateClick,
      disabled: !!isCreating,
      showLoader: !!isCreating,
    }),
    [handleCreateClick, isCreating]
  );
}

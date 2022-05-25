import {
  ChainId,
  CHAIN_ID_TERRA,
  createWrappedOnEth,
  createWrappedOnTerra,
  updateWrappedOnEth,
  updateWrappedOnTerra,
  createRemoteTokenWrapperOnAlph,
  isEVMChain,
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
import useAttestSignedVAA from "./useAttestSignedVAA";
import { setCreateTx, setIsCreating } from "../store/attestSlice";
import {
  selectAttestIsCreating,
  selectAttestSourceChain,
  selectAttestTargetChain,
  selectTerraFeeDenom,
} from "../store/selectors";
import {
  alphDustAmount,
  getTokenBridgeAddressForChain,
  TERRA_TOKEN_BRIDGE_ADDRESS,
} from "../utils/consts";
import parseError from "../utils/parseError";
import { Alert } from "@material-ui/lab";
import { postWithFees } from "../utils/terra";
import { AlephiumWalletSigner, useAlephiumWallet } from "../contexts/AlephiumWalletContext";
import { getTokenBridgeForChainIdWithRetry, submitAlphScriptTx, waitTxConfirmed } from "../utils/alephium";

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
    const receipt = shouldUpdate
      ? await updateWrappedOnEth(
          getTokenBridgeAddressForChain(chainId),
          signer,
          signedVAA
        )
      : await createWrappedOnEth(
          getTokenBridgeAddressForChain(chainId),
          signer,
          signedVAA
        );
    dispatch(
      setCreateTx({ id: receipt.transactionHash, block: receipt.blockNumber })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
  } catch (e) {
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsCreating(false));
  }
}

async function terra(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: ConnectedWallet,
  signedVAA: Uint8Array,
  shouldUpdate: boolean,
  feeDenom: string
) {
  dispatch(setIsCreating(true));
  try {
    const msg = shouldUpdate
      ? await updateWrappedOnTerra(
          TERRA_TOKEN_BRIDGE_ADDRESS,
          wallet.terraAddress,
          signedVAA
        )
      : await createWrappedOnTerra(
          TERRA_TOKEN_BRIDGE_ADDRESS,
          wallet.terraAddress,
          signedVAA
        );
    const result = await postWithFees(
      wallet,
      [msg],
      "Wormhole - Create Wrapped",
      [feeDenom]
    );
    dispatch(
      setCreateTx({ id: result.result.txhash, block: result.result.height })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
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
  signer: AlephiumWalletSigner,
  signedVAA: Uint8Array,
  shouldUpdate: boolean
) {
  dispatch(setIsCreating(true));
  try {
    if (shouldUpdate) {
      throw Error("alephium: does not support update")
    }
    const tokenBridgeForChainId = await getTokenBridgeForChainIdWithRetry(sourceChain)
    const bytecode = createRemoteTokenWrapperOnAlph(
      tokenBridgeForChainId,
      signedVAA,
      signer.account.address,
      alphDustAmount
    )
    const result = await submitAlphScriptTx(signer.walletProvider, signer.account.address, bytecode)
    const confirmedTx = await waitTxConfirmed(signer.nodeProvider, result.txId)
    const blockHeader = await signer.nodeProvider.blockflow.getBlockflowHeadersBlockHash(confirmedTx.blockHash)
    dispatch(
      setCreateTx({ id: result.txId, block: blockHeader.height })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
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
  const terraWallet = useConnectedWallet();
  const terraFeeDenom = useSelector(selectTerraFeeDenom);
  const { signer: alphSigner } = useAlephiumWallet();
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
    } else if (targetChain === CHAIN_ID_TERRA && !!terraWallet && !!signedVAA) {
      terra(
        dispatch,
        enqueueSnackbar,
        terraWallet,
        signedVAA,
        shouldUpdate,
        terraFeeDenom
      );
    } else if (targetChain === CHAIN_ID_ALEPHIUM && !!alphSigner && !!signedVAA) {
      alephium(
        dispatch,
        enqueueSnackbar,
        sourceChain,
        alphSigner,
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
    terraWallet,
    alphSigner,
    signedVAA,
    signer,
    shouldUpdate,
    terraFeeDenom,
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

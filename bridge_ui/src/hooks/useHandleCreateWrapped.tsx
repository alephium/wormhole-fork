import {
  ChainId,
  CHAIN_ID_ACALA,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  CHAIN_ID_ALEPHIUM,
  createWrappedOnAlgorand,
  createWrappedOnSolana,
  createWrappedOnTerra,
  isEVMChain,
  updateWrappedOnSolana,
  createRemoteTokenPoolOnAlph,
  updateRemoteTokenPoolOnAlph,
  updateWrappedOnTerra,
  getAttestTokenHandlerId
} from "@alephium/wormhole-sdk";
import { Alert } from "@material-ui/lab";
import { WalletContextState } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
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
import { setCreateTx, setIsCreating, setIsWalletApproved } from "../store/attestSlice";
import {
  selectAttestIsCreating,
  selectAttestSourceChain,
  selectAttestTargetChain,
  selectTerraFeeDenom,
} from "../store/selectors";
import { signSendAndConfirmAlgorand } from "../utils/algorand";
import {
  ACALA_HOST,
  ALGORAND_BRIDGE_ID,
  ALGORAND_HOST,
  ALGORAND_TOKEN_BRIDGE_ID,
  getTokenBridgeAddressForChain,
  KARURA_HOST,
  MAX_VAA_UPLOAD_RETRIES_SOLANA,
  SOLANA_HOST,
  SOL_BRIDGE_ADDRESS,
  SOL_TOKEN_BRIDGE_ADDRESS,
  TERRA_TOKEN_BRIDGE_ADDRESS,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  ALEPHIUM_BRIDGE_GROUP_INDEX,
} from "../utils/consts";
import { getKaruraGasParams } from "../utils/karura";
import parseError from "../utils/parseError";
import { postVaaWithRetry } from "../utils/postVaa";
import { signSendAndConfirm } from "../utils/solana";
import { postWithFees } from "../utils/terra";
import { waitALPHTxConfirmed } from "../utils/alephium";
import useAttestSignedVAA from "./useAttestSignedVAA";
import { createWrappedOnEthWithoutWait, updateWrappedOnEthWithoutWait } from "../utils/evm";
import { useWallet, Wallet as AlephiumWallet } from "@alephium/web3-react";
import { MINIMAL_CONTRACT_DEPOSIT } from "@alephium/web3";
import i18n from "../i18n";

async function algo(
  dispatch: any,
  enqueueSnackbar: any,
  senderAddr: string,
  signedVAA: Uint8Array
) {
  dispatch(setIsCreating(true));
  try {
    const algodClient = new algosdk.Algodv2(
      ALGORAND_HOST.algodToken,
      ALGORAND_HOST.algodServer,
      ALGORAND_HOST.algodPort
    );
    const txs = await createWrappedOnAlgorand(
      algodClient,
      ALGORAND_TOKEN_BRIDGE_ID,
      ALGORAND_BRIDGE_ID,
      senderAddr,
      signedVAA
    );
    const result = await signSendAndConfirmAlgorand(algodClient, txs);
    dispatch(
      setCreateTx({
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
    dispatch(setIsCreating(false));
  }
}

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
        ? await getKaruraGasParams(KARURA_HOST)
        : chainId === CHAIN_ID_ACALA
        ? await getKaruraGasParams(ACALA_HOST)
        : chainId === CHAIN_ID_KLAYTN
        ? { gasPrice: (await signer.getGasPrice()).toString() }
        : {};
    const result = shouldUpdate
      ? await updateWrappedOnEthWithoutWait(
          getTokenBridgeAddressForChain(chainId),
          signer,
          signedVAA,
          overrides
        )
      : await createWrappedOnEthWithoutWait(
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

async function solana(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: WalletContextState,
  payerAddress: string, // TODO: we may not need this since we have wallet
  signedVAA: Uint8Array,
  shouldUpdate: boolean
) {
  dispatch(setIsCreating(true));
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
    const transaction = shouldUpdate
      ? await updateWrappedOnSolana(
          connection,
          SOL_BRIDGE_ADDRESS,
          SOL_TOKEN_BRIDGE_ADDRESS,
          payerAddress,
          signedVAA
        )
      : await createWrappedOnSolana(
          connection,
          SOL_BRIDGE_ADDRESS,
          SOL_TOKEN_BRIDGE_ADDRESS,
          payerAddress,
          signedVAA
        );
    const txid = await signSendAndConfirm(wallet, connection, transaction);
    // TODO: didn't want to make an info call we didn't need, can we get the block without it by modifying the above call?
    dispatch(setCreateTx({ id: txid, blockHeight: 1 }));
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
      setCreateTx({ id: result.result.txhash, blockHeight: result.result.height })
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
    const attestTokenHandlerId = getAttestTokenHandlerId(ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID, sourceChain, ALEPHIUM_BRIDGE_GROUP_INDEX)
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
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const signedVAA = useAttestSignedVAA();
  const isCreating = useSelector(selectAttestIsCreating);
  const { signer } = useEthereumProvider();
  const terraWallet = useConnectedWallet();
  const terraFeeDenom = useSelector(selectTerraFeeDenom);
  const alphWallet = useWallet();
  const { accounts: algoAccounts } = useAlgorandContext();
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
    } else if (
      targetChain === CHAIN_ID_SOLANA &&
      !!solanaWallet &&
      !!solPK &&
      !!signedVAA
    ) {
      solana(
        dispatch,
        enqueueSnackbar,
        solanaWallet,
        solPK.toString(),
        signedVAA,
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
    } else if (targetChain === CHAIN_ID_ALEPHIUM && !!alphWallet && !!signedVAA) {
      alephium(
        dispatch,
        enqueueSnackbar,
        sourceChain,
        alphWallet,
        signedVAA,
        shouldUpdate
      )
    } else if (
      targetChain === CHAIN_ID_ALGORAND &&
      algoAccounts[0] &&
      !!signedVAA
    ) {
      algo(dispatch, enqueueSnackbar, algoAccounts[0]?.address, signedVAA);
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
    solanaWallet,
    solPK,
    terraWallet,
    alphWallet,
    signedVAA,
    signer,
    shouldUpdate,
    terraFeeDenom,
    algoAccounts,
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

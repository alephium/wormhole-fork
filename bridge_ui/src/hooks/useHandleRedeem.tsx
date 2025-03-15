import {
  ChainId,
  CHAIN_ID_KLAYTN,
  isEVMChain,
  CHAIN_ID_ALEPHIUM,
  uint8ArrayToHex,
  getTokenBridgeForChainId,
  getIsTransferCompletedAlph,
  redeemOnAlphWithReward,
  deserializeVAA,
  needToReward,
  deserializeTransferTokenVAA,
  redeemOnAlph
} from "@alephium/wormhole-sdk";
import { Alert } from "@material-ui/lab";
import axios from "axios";
import { Signer } from "ethers";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { selectTransferIsRedeeming, selectTransferTargetChain } from "../store/selectors";
import { setIsRedeemedViaRelayer, setIsRedeeming, setIsRedeemingViaRelayer, setIsWalletApproved, setRedeemCompleted, setRedeemTx } from "../store/transferSlice";
import {
  ACALA_RELAY_URL,
  ALEPHIUM_BRIDGE_GROUP_INDEX,
  ALEPHIUM_BRIDGE_REWARD_ROUTER_ID,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  getTokenBridgeAddressForChain,
  CLUSTER,
  RELAYER_HOST,
  BSC_TOKENS_FOR_REWARD,
} from "../utils/consts";
import parseError from "../utils/parseError";
import { getEmitterChainId, waitALPHTxConfirmed } from "../utils/alephium";
import useTransferSignedVAA from "./useTransferSignedVAA";
import { redeemOnEthNativeWithoutWait, redeemOnEthWithoutWait } from "../utils/evm";
import { useWallet, Wallet as AlephiumWallet } from "@alephium/web3-react";
import { SignerProvider } from "@alephium/web3";
import i18n from "../localization/i18n";

async function evm(
  dispatch: any,
  enqueueSnackbar: any,
  signer: Signer,
  signedVAA: Uint8Array,
  isNative: boolean,
  targetChainId: ChainId
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
      content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
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
    dispatch(setIsRedeemedViaRelayer(true))
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
  dispatch(setIsRedeemedViaRelayer(false))
  const parsedVaa = deserializeTransferTokenVAA(signedVAA)
  let txId: string
  if (needToReward(parsedVaa, BSC_TOKENS_FOR_REWARD)) {
    txId = (await redeemOnAlphWithReward(signer, ALEPHIUM_BRIDGE_REWARD_ROUTER_ID, tokenBridgeForChainId, signedVAA)).txId
  } else {
    txId = (await redeemOnAlph(signer, tokenBridgeForChainId, signedVAA)).txId
  }
  console.log(`the redemption tx has been submitted, txId: ${txId}`)
  dispatch(setIsWalletApproved(true))
  return txId
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
        content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
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
        content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
      });
    } else {
      enqueueSnackbar(null, {
        content: <Alert severity="error">{i18n.t('Transfer failed, please try again later')}</Alert>,
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
  const { signer } = useEthereumProvider();
  const alphWallet = useWallet();
  const signedVAA = useTransferSignedVAA();
  const isRedeeming = useSelector(selectTransferIsRedeeming);
  const handleRedeemClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && signedVAA) {
      evm(dispatch, enqueueSnackbar, signer, signedVAA, false, targetChain);
    } else if (targetChain === CHAIN_ID_ALEPHIUM && !!alphWallet && signedVAA) {
      alephium(dispatch, enqueueSnackbar, alphWallet, signedVAA)
    } else {
    }
  }, [
    dispatch,
    enqueueSnackbar,
    targetChain,
    signer,
    signedVAA,
    alphWallet
  ]);

  const handleRedeemNativeClick = useCallback(() => {
    if (isEVMChain(targetChain) && !!signer && signedVAA) {
      evm(dispatch, enqueueSnackbar, signer, signedVAA, true, targetChain);
    } else {
    }
  }, [
    dispatch,
    enqueueSnackbar,
    targetChain,
    signer,
    signedVAA
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
        content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
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

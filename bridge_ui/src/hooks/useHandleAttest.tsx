import {
  attestFromAlph,
  ChainId,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_ALEPHIUM,
  getEmitterAddressEth,
  isEVMChain,
  parseSequenceFromLogEth,
  uint8ArrayToHex,
  parseTargetChainFromLogEth,
  CHAIN_ID_ETH,
  CHAIN_ID_BSC,
  attestFromEth
} from "@alephium/wormhole-sdk";
import { Alert } from "@mui/material";
import { Signer } from "ethers";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
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
  selectAttestSourceChain
} from "../store/selectors";
import { getAndCheckLocalTokenInfo, isValidAlephiumTokenId, waitALPHTxConfirmed, waitTxConfirmedAndGetTxInfo } from "../utils/alephium";
import {
  ALEPHIUM_ATTEST_TOKEN_CONSISTENCY_LEVEL,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  ALEPHIUM_MESSAGE_FEE,
  getBridgeAddressForChain,
  getTokenBridgeAddressForChain,
} from "../utils/consts";
import { getSignedVAAWithRetry } from "../utils/getSignedVAAWithRetry";
import parseError from "../utils/parseError";
import { waitEVMTxConfirmed, checkETHToken, checkBSCToken } from "../utils/evm";
import { useWallet, Wallet as AlephiumWallet } from "@alephium/web3-react";
import i18n from "../i18n";

async function evm(
  dispatch: any,
  enqueueSnackbar: any,
  signer: Signer,
  sourceAsset: string,
  chainId: ChainId
) {
  dispatch(setIsSending(true));
  try {
    if (chainId === CHAIN_ID_ETH) {
      await checkETHToken(sourceAsset)
    } else if (chainId === CHAIN_ID_BSC) {
      await checkBSCToken(sourceAsset)
    }

    // Klaytn requires specifying gasPrice
    const overrides =
      chainId === CHAIN_ID_KLAYTN
        ? { gasPrice: (await signer.getGasPrice()).toString() }
        : {};
    const result = await attestFromEth(
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
      content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
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
      await waitEVMTxConfirmed(signer.provider, receipt.blockNumber, chainId)
    }
    enqueueSnackbar(null, {
      content: <Alert severity="info">{i18n.t('Fetching VAA')}</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      chainId,
      emitterAddress,
      targetChain,
      sequence
    );
    dispatch(setSignedVAAHex(uint8ArrayToHex(vaaBytes)));
    enqueueSnackbar(null, {
      content: <Alert severity="success">{i18n.t('Fetched Signed VAA')}</Alert>,
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
      throw new Error(i18n.t('Invalid local token: {{ tokenId }}, expected a 64 bytes hex string', { tokenId: localTokenId }))
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
      content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
    });
    await waitALPHTxConfirmed(wallet.nodeProvider, txInfo.txId, ALEPHIUM_ATTEST_TOKEN_CONSISTENCY_LEVEL)
    enqueueSnackbar(null, {
      content: <Alert severity="info">{i18n.t('Fetching VAA')}</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_ALEPHIUM,
      ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
      txInfo.targetChain,
      txInfo.sequence
    );
    dispatch(setSignedVAAHex(uint8ArrayToHex(vaaBytes)));
    enqueueSnackbar(null, {
      content: <Alert severity="success">{i18n.t('Fetched Signed VAA')}</Alert>,
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
  const alphWallet = useWallet();
  const disabled = !isTargetComplete || isSending || isSendComplete;
  const handleAttestClick = useCallback(() => {
    if (isEVMChain(sourceChain) && !!signer) {
      evm(dispatch, enqueueSnackbar, signer, sourceAsset, sourceChain);
    } else if (sourceChain === CHAIN_ID_ALEPHIUM && !!alphWallet) {
      alephium(dispatch, enqueueSnackbar, alphWallet, sourceAsset)
    } else {
    }
  }, [
    dispatch,
    enqueueSnackbar,
    sourceChain,
    signer,
    alphWallet,
    sourceAsset
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

import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_KLAYTN,
  getEmitterAddressEth,
  isEVMChain,
  parseSequenceFromLogEth,
  uint8ArrayToHex,
  transferRemoteTokenFromAlph,
  transferLocalTokenFromAlph,
  transferFromEth,
  transferFromEthNative,
  checkRecipientAddress
} from "@alephium/wormhole-sdk";
import { Alert } from "@mui/lab";
import { Signer } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import {
  selectTransferAmount,
  selectTransferIsSendComplete,
  selectTransferIsSending,
  selectTransferIsTargetComplete,
  selectTransferOriginAsset,
  selectTransferOriginChain,
  selectTransferRelayerFee,
  selectTransferSourceAsset,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccount,
  selectTransferTargetChain,
} from "../store/selectors";
import {
  setIsSending,
  setSignedVAAHex,
  setTransferTx,
  setRecoverySourceTxId,
  setIsWalletApproved
} from "../store/transferSlice";
import {
  ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  alphArbiterFee,
  ALEPHIUM_MESSAGE_FEE,
  getBridgeAddressForChain,
  getTokenBridgeAddressForChain
} from "../utils/consts";
import { getSignedVAAWithRetry } from "../utils/getSignedVAAWithRetry";
import parseError from "../utils/parseError";
import useTransferTargetAddressHex from "./useTransferTargetAddress";
import { getAlephiumRecipientAddrss, waitALPHTxConfirmed, waitTxConfirmedAndGetTxInfo } from "../utils/alephium";
import { ExecuteScriptResult } from "@alephium/web3";
import { waitEVMTxConfirmed } from "../utils/evm";
import { useWallet, Wallet as AlephiumWallet } from "@alephium/web3-react";
import i18n from "../i18n";

async function evm(
  dispatch: any,
  enqueueSnackbar: any,
  signer: Signer,
  tokenAddress: string,
  decimals: number,
  amount: string,
  recipientChain: ChainId,
  recipientAddress: Uint8Array,
  isNative: boolean,
  chainId: ChainId,
  relayerFee?: string
) {
  dispatch(setIsSending(true));
  try {
    const recipient = recipientChain === CHAIN_ID_ALEPHIUM
      ? getAlephiumRecipientAddrss(recipientAddress)
      : recipientAddress

    const baseAmountParsed = parseUnits(amount, decimals);
    const feeParsed = parseUnits(relayerFee || "0", decimals);
    const transferAmountParsed = baseAmountParsed.add(feeParsed);
    console.log(
      "base",
      baseAmountParsed,
      "fee",
      feeParsed,
      "total",
      transferAmountParsed
    );
    checkRecipientAddress(recipientChain, recipient)
    // Klaytn requires specifying gasPrice
    const overrides =
      chainId === CHAIN_ID_KLAYTN
        ? { gasPrice: (await signer.getGasPrice()).toString() }
        : {};
    const result = isNative
      ? await transferFromEthNative(
          getTokenBridgeAddressForChain(chainId),
          signer,
          transferAmountParsed,
          recipientChain,
          recipient,
          feeParsed,
          overrides
        )
      : await transferFromEth(
          getTokenBridgeAddressForChain(chainId),
          signer,
          tokenAddress,
          transferAmountParsed,
          recipientChain,
          recipient,
          feeParsed,
          overrides
        );
    dispatch(setIsWalletApproved(true))
    const receipt = await result.wait()
    dispatch(
      setTransferTx({ id: receipt.transactionHash, blockHeight: receipt.blockNumber })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
    });
    const sequence = parseSequenceFromLogEth(
      receipt,
      getBridgeAddressForChain(chainId)
    );
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
      recipientChain,
      sequence.toString()
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
  tokenId: string,
  originAsset: string,
  tokenChainId: ChainId,
  amount: string,
  decimals: number,
  targetChain: ChainId,
  targetAddress: Uint8Array,
) {
  if (wallet.nodeProvider === undefined) {
    return
  }
  dispatch(setIsSending(true))
  try {
    const amountParsed = parseUnits(amount, decimals).toBigInt()
    let result: ExecuteScriptResult
    if (tokenChainId === CHAIN_ID_ALEPHIUM) {
      result = await transferLocalTokenFromAlph(
        wallet.signer,
        ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
        wallet.account.address,
        tokenId,
        targetChain,
        uint8ArrayToHex(targetAddress),
        amountParsed,
        ALEPHIUM_MESSAGE_FEE,
        alphArbiterFee,
        ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL
      )
    } else {
      result = await transferRemoteTokenFromAlph(
        wallet.signer,
        ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
        wallet.account.address,
        tokenId,
        originAsset,
        tokenChainId,
        targetChain,
        uint8ArrayToHex(targetAddress),
        amountParsed,
        ALEPHIUM_MESSAGE_FEE,
        alphArbiterFee,
        ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL
      )
    }
    dispatch(setIsWalletApproved(true))
    const txInfo = await waitTxConfirmedAndGetTxInfo(wallet.nodeProvider, result.txId)
    dispatch(setTransferTx({ id: txInfo.txId, blockHeight: txInfo.blockHeight, blockTimestamp: txInfo.blockTimestamp }));
    dispatch(setRecoverySourceTxId(txInfo.txId))
    enqueueSnackbar(null, {
      content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
    });
    await waitALPHTxConfirmed(wallet.nodeProvider, txInfo.txId, ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL)
    enqueueSnackbar(null, {
      content: <Alert severity="info">{i18n.t('Fetching VAA')}</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_ALEPHIUM,
      ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
      targetChain,
      txInfo.sequence
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">{i18n.t('Fetched Signed VAA')}</Alert>,
    });
    dispatch(setSignedVAAHex(uint8ArrayToHex(vaaBytes)));
  } catch (e) {
    console.error(e);
    enqueueSnackbar(null, {
      content: <Alert severity="error">{parseError(e)}</Alert>,
    });
    dispatch(setIsSending(false));
  }
}

export function useHandleTransfer() {
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const sourceChain = useSelector(selectTransferSourceChain);
  const sourceAsset = useSelector(selectTransferSourceAsset);
  const originChain = useSelector(selectTransferOriginChain);
  const originAsset = useSelector(selectTransferOriginAsset);
  const amount = useSelector(selectTransferAmount);
  const targetChain = useSelector(selectTransferTargetChain);
  const targetAddress = useTransferTargetAddressHex();
  const isTargetComplete = useSelector(selectTransferIsTargetComplete);
  const isSending = useSelector(selectTransferIsSending);
  const isSendComplete = useSelector(selectTransferIsSendComplete);
  const { signer } = useEthereumProvider();
  const alphWallet = useWallet();
  const sourceParsedTokenAccount = useSelector(
    selectTransferSourceParsedTokenAccount
  );
  const relayerFee = useSelector(selectTransferRelayerFee);
  console.log("relayerFee", relayerFee);

  const decimals = sourceParsedTokenAccount?.decimals;
  const isNative = sourceParsedTokenAccount?.isNativeAsset || false;
  const disabled = !isTargetComplete || isSending || isSendComplete;

  const handleTransferClick = useCallback(() => {
    // TODO: we should separate state for transaction vs fetching vaa
    if (
      isEVMChain(sourceChain) &&
      !!signer &&
      !!sourceAsset &&
      decimals !== undefined &&
      !!targetAddress
    ) {
      evm(
        dispatch,
        enqueueSnackbar,
        signer,
        sourceAsset,
        decimals,
        amount,
        targetChain,
        targetAddress,
        isNative,
        sourceChain,
        relayerFee
      );
    } else if (
      sourceChain === CHAIN_ID_ALEPHIUM &&
      !!alphWallet &&
      !!sourceAsset &&
      decimals !== undefined &&
      !!targetAddress &&
      !!originAsset &&
      !!originChain
    ) {
      alephium(
        dispatch,
        enqueueSnackbar,
        alphWallet,
        sourceAsset,
        originAsset,
        originChain,
        amount,
        decimals,
        targetChain,
        targetAddress
      )
    }
  }, [
    dispatch,
    enqueueSnackbar,
    sourceChain,
    signer,
    relayerFee,
    alphWallet,
    sourceAsset,
    amount,
    decimals,
    targetChain,
    targetAddress,
    originAsset,
    originChain,
    isNative
  ]);
  return useMemo(
    () => ({
      handleClick: handleTransferClick,
      disabled,
      showLoader: isSending,
    }),
    [handleTransferClick, disabled, isSending]
  );
}

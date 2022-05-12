import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_TERRA,
  getEmitterAddressEth,
  getEmitterAddressTerra,
  isEVMChain,
  parseSequenceFromLogEth,
  parseSequenceFromLogTerra,
  transferFromEth,
  transferFromEthNative,
  transferFromTerra,
  uint8ArrayToHex,
  transferRemoteTokenFromAlph,
  transferLocalTokenFromAlph,
} from "@certusone/wormhole-sdk";
import { Alert } from "@material-ui/lab";
import {
  ConnectedWallet,
  useConnectedWallet,
} from "@terra-money/wallet-provider";
import { Signer } from "ethers";
import { parseUnits } from "ethers/lib/utils";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import {
  selectTerraFeeDenom,
  selectTransferAmount,
  selectTransferIsSendComplete,
  selectTransferIsSending,
  selectTransferIsTargetComplete,
  selectTransferOriginChain,
  selectTransferSourceAsset,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccount,
  selectTransferTargetChain,
} from "../store/selectors";
import {
  setIsSending,
  setSignedVAAHex,
  setTransferTx,
} from "../store/transferSlice";
import {
  ALEPHIUM_CONFIRMATIONS,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  alphArbiterFee,
  alphMessageFee,
  getBridgeAddressForChain,
  getTokenBridgeAddressForChain,
  TERRA_TOKEN_BRIDGE_ADDRESS,
} from "../utils/consts";
import { getSignedVAAWithRetry } from "../utils/getSignedVAAWithRetry";
import parseError from "../utils/parseError";
import { postWithFees, waitForTerraExecution } from "../utils/terra";
import useTransferTargetAddressHex from "./useTransferTargetAddress";
import { AlephiumWalletSigner, useAlephiumWallet } from "../contexts/AlephiumWalletContext";
import {
  getLocalTokenWrapperIdWithRetry,
  submitAlphScriptTx,
  waitTxConfirmedAndGetTxInfo,
} from "../utils/alephium";

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
  chainId: ChainId
) {
  dispatch(setIsSending(true));
  try {
    const amountParsed = parseUnits(amount, decimals);
    const receipt = isNative
      ? await transferFromEthNative(
          getTokenBridgeAddressForChain(chainId),
          signer,
          amountParsed,
          recipientChain,
          recipientAddress
        )
      : await transferFromEth(
          getTokenBridgeAddressForChain(chainId),
          signer,
          tokenAddress,
          amountParsed,
          recipientChain,
          recipientAddress
        );
    dispatch(
      setTransferTx({ id: receipt.transactionHash, block: receipt.blockNumber })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
    const sequence = parseSequenceFromLogEth(
      receipt,
      getBridgeAddressForChain(chainId)
    );
    const emitterAddress = getEmitterAddressEth(
      getTokenBridgeAddressForChain(chainId)
    );
    enqueueSnackbar(null, {
      content: <Alert severity="info">Fetching VAA</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      chainId,
      emitterAddress,
      sequence.toString()
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
  signer: AlephiumWalletSigner,
  tokenId: string,
  isLocalToken: boolean,
  amount: string,
  decimals: number,
  targetChain: ChainId,
  targetAddress: Uint8Array,
) {
  dispatch(setIsSending(true))
  try {
    const amountParsed = parseUnits(amount, decimals).toBigInt()
    const txInfo = await waitTxConfirmedAndGetTxInfo(
      signer.client, async () => {
        let bytecode: string 
        if (isLocalToken) {
          const tokenWrapperId = await getLocalTokenWrapperIdWithRetry(tokenId, targetChain)
          bytecode = transferLocalTokenFromAlph(
            tokenWrapperId,
            signer.account.address,
            tokenId,
            uint8ArrayToHex(targetAddress),
            amountParsed,
            alphMessageFee,
            alphArbiterFee,
            ALEPHIUM_CONFIRMATIONS
          )
        } else {
          bytecode = transferRemoteTokenFromAlph(
            tokenId,
            signer.account.address,
            uint8ArrayToHex(targetAddress),
            amountParsed,
            alphMessageFee,
            alphArbiterFee,
            ALEPHIUM_CONFIRMATIONS
          )
        }
        const result = await submitAlphScriptTx(signer.provider, signer.account.address, bytecode)
        return result.txId
      }
    )
    dispatch(setTransferTx({ id: txInfo.txId, block: txInfo.blockHeight }));
    enqueueSnackbar(null, {
      content: <Alert severity="success">Transaction confirmed</Alert>,
    });
    enqueueSnackbar(null, {
      content: <Alert severity="info">Fetching VAA</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_ALEPHIUM,
      ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
      txInfo.sequence
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Fetched Signed VAA</Alert>,
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

async function terra(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: ConnectedWallet,
  asset: string,
  amount: string,
  decimals: number,
  targetChain: ChainId,
  targetAddress: Uint8Array,
  feeDenom: string
) {
  dispatch(setIsSending(true));
  try {
    const amountParsed = parseUnits(amount, decimals).toString();
    const msgs = await transferFromTerra(
      wallet.terraAddress,
      TERRA_TOKEN_BRIDGE_ADDRESS,
      asset,
      amountParsed,
      targetChain,
      targetAddress
    );

    const result = await postWithFees(
      wallet,
      msgs,
      "Wormhole - Initiate Transfer",
      [feeDenom]
    );

    const info = await waitForTerraExecution(result);
    dispatch(setTransferTx({ id: info.txhash, block: info.height }));
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
      sequence
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">Fetched Signed VAA</Alert>,
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
  const amount = useSelector(selectTransferAmount);
  const targetChain = useSelector(selectTransferTargetChain);
  const targetAddress = useTransferTargetAddressHex();
  const isTargetComplete = useSelector(selectTransferIsTargetComplete);
  const isSending = useSelector(selectTransferIsSending);
  const isSendComplete = useSelector(selectTransferIsSendComplete);
  const { signer } = useEthereumProvider();
  const terraWallet = useConnectedWallet();
  const { signer: alphSigner } = useAlephiumWallet();
  const terraFeeDenom = useSelector(selectTerraFeeDenom);
  const sourceParsedTokenAccount = useSelector(
    selectTransferSourceParsedTokenAccount
  );
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
        sourceChain
      );
    } else if (
      sourceChain === CHAIN_ID_TERRA &&
      !!terraWallet &&
      !!sourceAsset &&
      decimals !== undefined &&
      !!targetAddress
    ) {
      terra(
        dispatch,
        enqueueSnackbar,
        terraWallet,
        sourceAsset,
        amount,
        decimals,
        targetChain,
        targetAddress,
        terraFeeDenom
      );
    } else if (
      sourceChain === CHAIN_ID_ALEPHIUM &&
      !!alphSigner &&
      !!sourceAsset &&
      decimals !== undefined &&
      !!targetAddress
    ) {
      alephium(
        dispatch,
        enqueueSnackbar,
        alphSigner,
        sourceAsset,
        originChain === CHAIN_ID_ALEPHIUM,
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
    terraWallet,
    alphSigner,
    sourceAsset,
    amount,
    decimals,
    targetChain,
    targetAddress,
    originChain,
    isNative,
    terraFeeDenom,
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

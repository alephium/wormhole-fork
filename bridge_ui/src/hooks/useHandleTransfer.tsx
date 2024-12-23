import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  getEmitterAddressAlgorand,
  getEmitterAddressEth,
  getEmitterAddressSolana,
  getEmitterAddressTerra,
  hexToUint8Array,
  isEVMChain,
  parseSequenceFromLogAlgorand,
  parseSequenceFromLogEth,
  parseSequenceFromLogSolana,
  parseSequenceFromLogTerra,
  transferFromAlgorand,
  transferFromSolana,
  transferFromTerra,
  transferNativeSol,
  uint8ArrayToHex,
  transferRemoteTokenFromAlph,
  transferLocalTokenFromAlph
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
import { parseUnits, zeroPad } from "ethers/lib/utils";
import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAlgorandContext } from "../contexts/AlgorandWalletContext";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import {
  selectTerraFeeDenom,
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
import { signSendAndConfirmAlgorand } from "../utils/algorand";
import {
  ALEPHIUM_MINIMAL_CONSISTENCY_LEVEL,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  alphArbiterFee,
  ALEPHIUM_MESSAGE_FEE,
  ALGORAND_BRIDGE_ID,
  ALGORAND_HOST,
  ALGORAND_TOKEN_BRIDGE_ID,
  getBridgeAddressForChain,
  getTokenBridgeAddressForChain,
  SOLANA_HOST,
  SOL_BRIDGE_ADDRESS,
  SOL_TOKEN_BRIDGE_ADDRESS,
  TERRA_TOKEN_BRIDGE_ADDRESS,
  ALEPHIUM_BRIDGE_GROUP_INDEX,
} from "../utils/consts";
import { getSignedVAAWithRetry } from "../utils/getSignedVAAWithRetry";
import parseError from "../utils/parseError";
import { signSendAndConfirm } from "../utils/solana";
import { postWithFees, waitForTerraExecution } from "../utils/terra";
import useTransferTargetAddressHex from "./useTransferTargetAddress";
import { validateAlephiumRecipientAddress, waitALPHTxConfirmed, waitTxConfirmedAndGetTxInfo } from "../utils/alephium";
import { ExecuteScriptResult } from "@alephium/web3";
import { transferFromEthNativeWithoutWait, transferFromEthWithoutWait, waitEVMTxConfirmed } from "../utils/evm";
import { useWallet, Wallet as AlephiumWallet } from "@alephium/web3-react";
import i18n from "../i18n";

async function algo(
  dispatch: any,
  enqueueSnackbar: any,
  senderAddr: string,
  tokenAddress: string,
  decimals: number,
  amount: string,
  recipientChain: ChainId,
  recipientAddress: Uint8Array,
  chainId: ChainId,
  relayerFee?: string
) {
  dispatch(setIsSending(true));
  try {
    const baseAmountParsed = parseUnits(amount, decimals);
    const feeParsed = parseUnits(relayerFee || "0", decimals);
    const transferAmountParsed = baseAmountParsed.add(feeParsed);
    const algodClient = new algosdk.Algodv2(
      ALGORAND_HOST.algodToken,
      ALGORAND_HOST.algodServer,
      ALGORAND_HOST.algodPort
    );
    const txs = await transferFromAlgorand(
      algodClient,
      ALGORAND_TOKEN_BRIDGE_ID,
      ALGORAND_BRIDGE_ID,
      senderAddr,
      BigInt(tokenAddress),
      transferAmountParsed.toBigInt(),
      uint8ArrayToHex(recipientAddress),
      recipientChain,
      feeParsed.toBigInt()
    );
    const result = await signSendAndConfirmAlgorand(algodClient, txs);
    const sequence = parseSequenceFromLogAlgorand(result);
    dispatch(
      setTransferTx({
        id: txs[txs.length - 1].tx.txID(),
        blockHeight: result["confirmed-round"],
      })
    );
    enqueueSnackbar(null, {
      content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
    });
    const emitterAddress = getEmitterAddressAlgorand(ALGORAND_TOKEN_BRIDGE_ID);
    enqueueSnackbar(null, {
      content: <Alert severity="info">{i18n.t('Fetching VAA')}</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      chainId,
      emitterAddress,
      recipientChain,
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
    if (recipientChain === CHAIN_ID_ALEPHIUM && !validateAlephiumRecipientAddress(recipientAddress)) {
      throw new Error(`Invalid recipient address, please connect to an address on group ${ALEPHIUM_BRIDGE_GROUP_INDEX}`)
    }
    // Klaytn requires specifying gasPrice
    const overrides =
      chainId === CHAIN_ID_KLAYTN
        ? { gasPrice: (await signer.getGasPrice()).toString() }
        : {};
    const result = isNative
      ? await transferFromEthNativeWithoutWait(
          getTokenBridgeAddressForChain(chainId),
          signer,
          transferAmountParsed,
          recipientChain,
          recipientAddress,
          feeParsed,
          overrides
        )
      : await transferFromEthWithoutWait(
          getTokenBridgeAddressForChain(chainId),
          signer,
          tokenAddress,
          transferAmountParsed,
          recipientChain,
          recipientAddress,
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

async function solana(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: WalletContextState,
  payerAddress: string, //TODO: we may not need this since we have wallet
  fromAddress: string,
  mintAddress: string,
  amount: string,
  decimals: number,
  targetChain: ChainId,
  targetAddress: Uint8Array,
  isNative: boolean,
  originAddressStr?: string,
  originChain?: ChainId,
  relayerFee?: string
) {
  dispatch(setIsSending(true));
  try {
    const connection = new Connection(SOLANA_HOST, "confirmed");
    const baseAmountParsed = parseUnits(amount, decimals);
    const feeParsed = parseUnits(relayerFee || "0", decimals);
    const transferAmountParsed = baseAmountParsed.add(feeParsed);
    const originAddress = originAddressStr
      ? zeroPad(hexToUint8Array(originAddressStr), 32)
      : undefined;
    const promise = isNative
      ? transferNativeSol(
          connection,
          SOL_BRIDGE_ADDRESS,
          SOL_TOKEN_BRIDGE_ADDRESS,
          payerAddress,
          transferAmountParsed.toBigInt(),
          targetAddress,
          targetChain,
          feeParsed.toBigInt()
        )
      : transferFromSolana(
          connection,
          SOL_BRIDGE_ADDRESS,
          SOL_TOKEN_BRIDGE_ADDRESS,
          payerAddress,
          fromAddress,
          mintAddress,
          transferAmountParsed.toBigInt(),
          targetAddress,
          targetChain,
          originAddress,
          originChain,
          undefined,
          feeParsed.toBigInt()
        );
    const transaction = await promise;
    const txid = await signSendAndConfirm(wallet, connection, transaction);
    enqueueSnackbar(null, {
      content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
    });
    const info = await connection.getTransaction(txid);
    if (!info) {
      throw new Error("An error occurred while fetching the transaction info");
    }
    dispatch(setTransferTx({ id: txid, blockHeight: info.slot }));
    const sequence = parseSequenceFromLogSolana(info);
    const emitterAddress = await getEmitterAddressSolana(
      SOL_TOKEN_BRIDGE_ADDRESS
    );
    enqueueSnackbar(null, {
      content: <Alert severity="info">{i18n.t('Fetching VAA')}</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_SOLANA,
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

async function terra(
  dispatch: any,
  enqueueSnackbar: any,
  wallet: ConnectedWallet,
  asset: string,
  amount: string,
  decimals: number,
  targetChain: ChainId,
  targetAddress: Uint8Array,
  feeDenom: string,
  relayerFee?: string
) {
  dispatch(setIsSending(true));
  try {
    const baseAmountParsed = parseUnits(amount, decimals);
    const feeParsed = parseUnits(relayerFee || "0", decimals);
    const transferAmountParsed = baseAmountParsed.add(feeParsed);
    const msgs = await transferFromTerra(
      wallet.terraAddress,
      TERRA_TOKEN_BRIDGE_ADDRESS,
      asset,
      transferAmountParsed.toString(),
      targetChain,
      targetAddress,
      feeParsed.toString()
    );

    const result = await postWithFees(
      wallet,
      msgs,
      "Wormhole - Initiate Transfer",
      [feeDenom]
    );

    const info = await waitForTerraExecution(result);
    dispatch(setTransferTx({ id: info.txhash, blockHeight: info.height }));
    enqueueSnackbar(null, {
      content: <Alert severity="success">{i18n.t('Transaction confirmed')}</Alert>,
    });
    const sequence = parseSequenceFromLogTerra(info);
    if (!sequence) {
      throw new Error("Sequence not found");
    }
    const emitterAddress = await getEmitterAddressTerra(
      TERRA_TOKEN_BRIDGE_ADDRESS
    );
    enqueueSnackbar(null, {
      content: <Alert severity="info">{i18n.t('Fetching VAA')}</Alert>,
    });
    const { vaaBytes } = await getSignedVAAWithRetry(
      CHAIN_ID_TERRA,
      emitterAddress,
      targetChain,
      sequence
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
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const terraWallet = useConnectedWallet();
  const alphWallet = useWallet();
  const terraFeeDenom = useSelector(selectTerraFeeDenom);
  const { accounts: algoAccounts } = useAlgorandContext();
  const sourceParsedTokenAccount = useSelector(
    selectTransferSourceParsedTokenAccount
  );
  const relayerFee = useSelector(selectTransferRelayerFee);
  console.log("relayerFee", relayerFee);

  const sourceTokenPublicKey = sourceParsedTokenAccount?.publicKey;
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
      sourceChain === CHAIN_ID_SOLANA &&
      !!solanaWallet &&
      !!solPK &&
      !!sourceAsset &&
      !!sourceTokenPublicKey &&
      !!targetAddress &&
      decimals !== undefined
    ) {
      solana(
        dispatch,
        enqueueSnackbar,
        solanaWallet,
        solPK.toString(),
        sourceTokenPublicKey,
        sourceAsset,
        amount,
        decimals,
        targetChain,
        targetAddress,
        isNative,
        originAsset,
        originChain,
        relayerFee
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
        terraFeeDenom,
        relayerFee
      );
    } else if (
      sourceChain === CHAIN_ID_ALGORAND &&
      algoAccounts[0] &&
      !!sourceAsset &&
      decimals !== undefined &&
      !!targetAddress
    ) {
      algo(
        dispatch,
        enqueueSnackbar,
        algoAccounts[0].address,
        sourceAsset,
        decimals,
        amount,
        targetChain,
        targetAddress,
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
    solanaWallet,
    solPK,
    terraWallet,
    alphWallet,
    sourceTokenPublicKey,
    sourceAsset,
    amount,
    decimals,
    targetChain,
    targetAddress,
    originAsset,
    originChain,
    isNative,
    terraFeeDenom,
    algoAccounts,
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

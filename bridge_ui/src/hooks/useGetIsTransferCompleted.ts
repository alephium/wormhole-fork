import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  getIsTransferCompletedAlgorand,
  getIsTransferCompletedEth,
  getIsTransferCompletedSolana,
  getIsTransferCompletedTerra,
  getIsTransferCompletedAlph,
  isEVMChain,
  getTokenBridgeForChainId,
} from "@alephium/wormhole-sdk";
import { Connection } from "@solana/web3.js";
import { LCDClient } from "@terra-money/terra.js";
import algosdk from "algosdk";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import {
  selectTransferIsRecovery,
  selectTransferSourceChain,
  selectTransferTargetAddressHex,
  selectTransferTargetChain,
} from "../store/selectors";
import {
  ALEPHIUM_BRIDGE_GROUP_INDEX,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID,
  ALGORAND_HOST,
  ALGORAND_TOKEN_BRIDGE_ID,
  getEvmChainId,
  getTokenBridgeAddressForChain,
  SOLANA_HOST,
  TERRA_GAS_PRICES_URL,
  TERRA_HOST,
} from "../utils/consts";
import useIsWalletReady from "./useIsWalletReady";
import useTransferSignedVAA from "./useTransferSignedVAA";
import { useWallet } from "@alephium/web3-react";
import { useTranslation } from "react-i18next";

/**
 * @param recoveryOnly Only fire when in recovery mode
 */
export default function useGetIsTransferCompleted(
  recoveryOnly: boolean,
  pollFrequency?: number
): {
  isTransferCompletedLoading: boolean;
  isTransferCompleted: boolean;
  error: string | undefined;
} {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isTransferCompleted, setIsTransferCompleted] = useState(false);
  const [error, setError] = useState<string>()

  const isRecovery = useSelector(selectTransferIsRecovery);
  const targetAddress = useSelector(selectTransferTargetAddressHex);
  const targetChain = useSelector(selectTransferTargetChain);
  const sourceChain = useSelector(selectTransferSourceChain)

  const { isReady } = useIsWalletReady(targetChain, false);
  const { provider, chainId: evmChainId } = useEthereumProvider();
  const alphWallet = useWallet()
  const signedVAA = useTransferSignedVAA();

  const hasCorrectEvmNetwork = evmChainId === getEvmChainId(targetChain);
  const shouldFire = !recoveryOnly || isRecovery;
  const [pollState, setPollState] = useState(pollFrequency);

  console.log(
    "Executing get transfer completed",
    isTransferCompleted,
    pollState
  );

  useEffect(() => {
    let cancelled = false;
    if (pollFrequency && !isLoading && !isTransferCompleted) {
      setTimeout(() => {
        if (!cancelled) {
          setPollState((prevState) => (prevState || 0) + 1);
        }
      }, pollFrequency);
    }
    return () => {
      cancelled = true;
    };
  }, [pollFrequency, isLoading, isTransferCompleted]);

  useEffect(() => {
    if (!shouldFire) {
      return;
    }

    let cancelled = false;
    let transferCompleted = false;
    if (targetChain && targetAddress && signedVAA && isReady) {
      if (isEVMChain(targetChain) && hasCorrectEvmNetwork && provider) {
        setIsLoading(true);
        (async () => {
          try {
            transferCompleted = await getIsTransferCompletedEth(
              getTokenBridgeAddressForChain(targetChain),
              provider,
              signedVAA
            );
          } catch (error) {
            const errMsg = `${t('Failed to check if the transfer tx has been completed')}, ${t('Error')}: ${error}`
            setError(errMsg)
            console.error(errMsg);
          }
          if (!cancelled) {
            setIsTransferCompleted(transferCompleted);
            setIsLoading(false);
          }
        })();
      } else if (targetChain === CHAIN_ID_SOLANA) {
        setIsLoading(true);
        (async () => {
          try {
            const connection = new Connection(SOLANA_HOST, "confirmed");
            transferCompleted = await getIsTransferCompletedSolana(
              getTokenBridgeAddressForChain(targetChain),
              signedVAA,
              connection
            );
          } catch (error) {
            console.error(error);
          }
          if (!cancelled) {
            setIsTransferCompleted(transferCompleted);
            setIsLoading(false);
          }
        })();
      } else if (targetChain === CHAIN_ID_TERRA) {
        setIsLoading(true);
        (async () => {
          try {
            const lcdClient = new LCDClient(TERRA_HOST);
            transferCompleted = await getIsTransferCompletedTerra(
              getTokenBridgeAddressForChain(targetChain),
              signedVAA,
              lcdClient,
              TERRA_GAS_PRICES_URL
            );
          } catch (error) {
            console.error(error);
          }
          if (!cancelled) {
            setIsTransferCompleted(transferCompleted);
            setIsLoading(false);
          }
        })();
      } else if (targetChain === CHAIN_ID_ALEPHIUM && alphWallet.connectionStatus === 'connected') {
        setIsLoading(true);
        (async () => {
          try {
            if (typeof sourceChain === 'undefined') {
              throw Error(t("Transfer source chain is undefined"))
            }

            const tokenBridgeForChainId = getTokenBridgeForChainId(ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID, sourceChain, ALEPHIUM_BRIDGE_GROUP_INDEX)
            transferCompleted = await getIsTransferCompletedAlph(
              tokenBridgeForChainId,
              alphWallet.account.group,
              signedVAA
            )
          } catch (error) {
            const errMsg = `${t('Failed to check if the transfer tx has been completed')}, ${t('Error')}: ${error}`
            setError(errMsg)
            console.error(errMsg)
          }
          if (!cancelled) {
            setIsTransferCompleted(transferCompleted)
            setIsLoading(false)
          }
        })()
      } else if (targetChain === CHAIN_ID_ALGORAND) {
        setIsLoading(true);
        (async () => {
          try {
            const algodClient = new algosdk.Algodv2(
              ALGORAND_HOST.algodToken,
              ALGORAND_HOST.algodServer,
              ALGORAND_HOST.algodPort
            );
            transferCompleted = await getIsTransferCompletedAlgorand(
              algodClient,
              ALGORAND_TOKEN_BRIDGE_ID,
              signedVAA
            );
          } catch (error) {
            console.error(error);
          }
          if (!cancelled) {
            setIsTransferCompleted(transferCompleted);
            setIsLoading(false);
          }
        })();
      }
    }
    return () => {
      cancelled = true;
    };
  }, [
    shouldFire,
    hasCorrectEvmNetwork,
    targetChain,
    sourceChain,
    targetAddress,
    signedVAA,
    isReady,
    provider,
    alphWallet,
    pollState,
    t
  ]);

  return { isTransferCompletedLoading: isLoading, isTransferCompleted, error };
}

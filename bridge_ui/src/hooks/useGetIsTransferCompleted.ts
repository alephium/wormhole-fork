import {
  CHAIN_ID_ALEPHIUM,
  getIsTransferCompletedEth,
  getIsTransferCompletedAlph,
  isEVMChain,
  getTokenBridgeForChainId,
} from "@alephium/wormhole-sdk";
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
  getEvmChainId,
  getTokenBridgeAddressForChain
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
              ALEPHIUM_BRIDGE_GROUP_INDEX,
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

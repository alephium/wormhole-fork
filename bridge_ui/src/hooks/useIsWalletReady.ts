import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_SOLANA,
  isEVMChain,
} from "@alephium/wormhole-sdk";
import { hexlify, hexStripZeros } from "@ethersproject/bytes";
import { useCallback, useMemo } from "react";
import { useAlgorandContext } from "../contexts/AlgorandWalletContext";
import {
  ConnectType,
  useEthereumProvider,
} from "../contexts/EthereumProviderContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import { CLUSTER, getEvmChainId } from "../utils/consts";
import { METAMASK_CHAIN_PARAMETERS } from "../utils/metaMaskChainParameters";
import { useWallet } from "@alephium/web3-react";
import { useTranslation } from "react-i18next";

const createWalletStatus = (
  isReady: boolean,
  statusMessage: string = "",
  forceNetworkSwitch: () => void,
  walletAddress?: string
) => ({
  isReady,
  statusMessage,
  forceNetworkSwitch,
  walletAddress,
});

function useIsWalletReady(
  chainId: ChainId,
  enableNetworkAutoswitch: boolean = true
): {
  isReady: boolean;
  statusMessage: string;
  walletAddress?: string;
  forceNetworkSwitch: () => void;
} {
  const { t } = useTranslation();
  const autoSwitch = enableNetworkAutoswitch;
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const alphWallet = useWallet();
  const {
    provider,
    signerAddress,
    chainId: evmChainId,
    connectType,
    walletConnectProvider
  } = useEthereumProvider();
  const hasEthInfo = !!provider && !!signerAddress;
  const correctEvmNetwork = getEvmChainId(chainId);
  const hasCorrectEvmNetwork = evmChainId === correctEvmNetwork;
  const { accounts: algorandAccounts } = useAlgorandContext();
  const algoPK = algorandAccounts[0]?.address;

  const forceNetworkSwitch = useCallback(async () => {
    if (provider && correctEvmNetwork) {
      if (!isEVMChain(chainId)) {
        return;
      }
      try {
        if (connectType === ConnectType.WALLETCONNECT && walletConnectProvider) {
          await walletConnectProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: hexStripZeros(hexlify(correctEvmNetwork)) }]
          })
          return
        }
      } catch (error) {
        console.error(`Failed to switch chain to ${correctEvmNetwork}: `, error)
        return
      }

      try {
        if (connectType === ConnectType.METAMASK) {
          await provider.send("wallet_switchEthereumChain", [
            { chainId: hexStripZeros(hexlify(correctEvmNetwork)) },
          ]);
        }
      } catch (switchError: any) {
        // This error code indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
          const addChainParameter =
            METAMASK_CHAIN_PARAMETERS[correctEvmNetwork];
          if (addChainParameter !== undefined) {
            try {
              await provider.send("wallet_addEthereumChain", [
                addChainParameter,
              ]);
            } catch (addError) {
              console.error(addError);
            }
          }
        }
      }
    }
  }, [provider, correctEvmNetwork, chainId, connectType, walletConnectProvider]);

  return useMemo(() => {
    if (chainId === CHAIN_ID_ALEPHIUM && alphWallet && alphWallet.nodeProvider) {
      return createWalletStatus(
        true,
        undefined,
        forceNetworkSwitch,
        alphWallet.account.address
      );
    }
    if (chainId === CHAIN_ID_SOLANA && solPK) {
      return createWalletStatus(
        true,
        undefined,
        forceNetworkSwitch,
        solPK.toString()
      );
    }
    if (chainId === CHAIN_ID_ALGORAND && algoPK) {
      return createWalletStatus(true, undefined, forceNetworkSwitch, algoPK);
    }
    if (isEVMChain(chainId) && hasEthInfo && signerAddress) {
      if (hasCorrectEvmNetwork) {
        return createWalletStatus(
          true,
          undefined,
          forceNetworkSwitch,
          signerAddress
        );
      } else {
        if (provider && correctEvmNetwork && autoSwitch) {
          forceNetworkSwitch();
        }
        return createWalletStatus(
          false,
          `${t('Wallet is not connected to {{ cluster }}', { cluster: CLUSTER })}. ${t('Expected Chain ID')}: ${correctEvmNetwork}`,
          forceNetworkSwitch,
          undefined
        );
      }
    }

    return createWalletStatus(
      false,
      t("Wallet is not connected"),
      forceNetworkSwitch,
      undefined
    );
  }, [
    chainId,
    autoSwitch,
    forceNetworkSwitch,
    solPK,
    hasEthInfo,
    correctEvmNetwork,
    hasCorrectEvmNetwork,
    provider,
    signerAddress,
    alphWallet,
    algoPK,
    t
  ]);
}

export default useIsWalletReady;

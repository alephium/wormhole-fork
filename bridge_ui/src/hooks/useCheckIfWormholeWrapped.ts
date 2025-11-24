import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  getOriginalAssetEth,
  isEVMChain,
  uint8ArrayToHex,
  WormholeWrappedInfo,
  coalesceChainName
} from "@alephium/wormhole-sdk";
import {
  getOriginalAssetEth as getOriginalAssetEthNFT,
} from "@alephium/wormhole-sdk/lib/esm/nft_bridge";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "@alephium/bridge-widget";
import { setSourceWormholeWrappedInfo as setNFTSourceWormholeWrappedInfo } from "../store/nftSlice";
import {
  selectNFTIsRecovery,
  selectNFTSourceAsset,
  selectNFTSourceChain,
  selectNFTSourceParsedTokenAccount,
  selectTransferIsRecovery,
  selectTransferSourceAsset,
  selectTransferSourceChain,
} from "../store/selectors";
import { setSourceWormholeWrappedInfo as setTransferSourceWormholeWrappedInfo } from "../store/transferSlice";
import {
  getEvmChainId,
  getNFTBridgeAddressForChain,
  getTokenBridgeAddressForChain
} from "../utils/consts";
import { NodeProvider } from '@alephium/web3'
import { getAlephiumTokenWrappedInfo } from "../utils/alephium";
import { errorDataWrapper, fetchDataWrapper, receiveDataWrapper } from "../store/helpers";
import { useWallet } from "@alephium/web3-react";
import { useTranslation } from "react-i18next";
import { getEvmJsonRpcProvider } from "../utils/evm";

export interface StateSafeWormholeWrappedInfo {
  isWrapped: boolean;
  chainId: ChainId;
  assetAddress: string;
  tokenId?: string;
}

const makeStateSafe = (
  info: WormholeWrappedInfo
): StateSafeWormholeWrappedInfo => ({
  ...info,
  assetAddress: uint8ArrayToHex(info.assetAddress),
});

async function getAlephiumTokenInfo(provider: NodeProvider, tokenId: string): Promise<StateSafeWormholeWrappedInfo> {
  const tokenInfo = await getAlephiumTokenWrappedInfo(tokenId, provider)
  if (tokenInfo.isWrapped) {
    const originalAsset = uint8ArrayToHex(tokenInfo.assetAddress)
    return {
      isWrapped: true,
      chainId: tokenInfo.chainId,
      assetAddress: originalAsset,
      tokenId: originalAsset
    }
  } else {
    return {
      isWrapped: false,
      chainId: CHAIN_ID_ALEPHIUM,
      assetAddress: tokenId,
      tokenId: tokenId
    }
  }
}

// Check if the tokens in the configured source chain/address are wrapped
// tokens. Wrapped tokens are tokens that are non-native, I.E, are locked up on
// a different chain than this one.
function useCheckIfWormholeWrapped(nft?: boolean) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const sourceChain = useSelector(
    nft ? selectNFTSourceChain : selectTransferSourceChain
  );
  const sourceAsset = useSelector(
    nft ? selectNFTSourceAsset : selectTransferSourceAsset
  );
  const nftSourceParsedTokenAccount = useSelector(
    selectNFTSourceParsedTokenAccount
  );
  const tokenId = nftSourceParsedTokenAccount?.tokenId || ""; // this should exist by this step for NFT transfers
  const setSourceWormholeWrappedInfo = nft
    ? setNFTSourceWormholeWrappedInfo
    : setTransferSourceWormholeWrappedInfo;
  const { provider: evmProvider, chainId: evmChainId } = useEthereumProvider();
  const isRecovery = useSelector(
    nft ? selectNFTIsRecovery : selectTransferIsRecovery
  );
  const alphWallet = useWallet()
  useEffect(() => {
    if (isRecovery) {
      return;
    }
    let cancelled = false;
    (async () => {
      if (isEVMChain(sourceChain) && sourceAsset) {
        // use JsonRpcProvider if both source chain and target chain are evm chains
        const provider = evmChainId === getEvmChainId(sourceChain) ? evmProvider : getEvmJsonRpcProvider(sourceChain)
        if (provider === undefined) {
          throw new Error(`Invalid evm chain id: ${sourceChain}`)
        }
        dispatch(setSourceWormholeWrappedInfo(fetchDataWrapper()));
        try {
          const wrappedInfo = makeStateSafe(
            await (nft
              ? getOriginalAssetEthNFT(
                  getNFTBridgeAddressForChain(sourceChain),
                  provider,
                  sourceAsset,
                  tokenId,
                  sourceChain
                )
              : getOriginalAssetEth(
                  getTokenBridgeAddressForChain(sourceChain),
                  provider,
                  sourceAsset,
                  sourceChain
                ))
          );
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(receiveDataWrapper(wrappedInfo)));
          }
        } catch (e) {
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(errorDataWrapper(`${t('Failed to get source asset info from {{ chainName }}', { chainName: coalesceChainName(sourceChain) })}, ${t('Error')}: ${e}`)));
          }
        }
      }
      if (sourceChain === CHAIN_ID_ALEPHIUM && sourceAsset && alphWallet?.nodeProvider !== undefined) {
        try {
          dispatch(setSourceWormholeWrappedInfo(fetchDataWrapper()));
          const wrappedInfo = await getAlephiumTokenInfo(alphWallet.nodeProvider, sourceAsset)
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(receiveDataWrapper(wrappedInfo)))
          }
        } catch (e) {
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(errorDataWrapper(`${t('Failed to get source asset info from alephium')}, ${t('Error')}: ${e}`)));
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    dispatch,
    isRecovery,
    sourceChain,
    sourceAsset,
    evmProvider,
    evmChainId,
    alphWallet,
    nft,
    setSourceWormholeWrappedInfo,
    tokenId,
    t
  ]);
}

export default useCheckIfWormholeWrapped;

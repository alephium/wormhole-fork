import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  getOriginalAssetAlgorand,
  getOriginalAssetEth,
  getOriginalAssetSol,
  getOriginalAssetTerra,
  isEVMChain,
  uint8ArrayToHex,
  WormholeWrappedInfo,
  coalesceChainName
} from "@alephium/wormhole-sdk";
import {
  getOriginalAssetEth as getOriginalAssetEthNFT,
  getOriginalAssetSol as getOriginalAssetSolNFT,
} from "@alephium/wormhole-sdk/lib/esm/nft_bridge";
import { Connection } from "@solana/web3.js";
import { LCDClient } from "@terra-money/terra.js";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
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
  ALGORAND_HOST,
  ALGORAND_TOKEN_BRIDGE_ID,
  getNFTBridgeAddressForChain,
  getTokenBridgeAddressForChain,
  SOLANA_HOST,
  SOL_NFT_BRIDGE_ADDRESS,
  SOL_TOKEN_BRIDGE_ADDRESS,
  TERRA_HOST,
} from "../utils/consts";
import { NodeProvider } from '@alephium/web3'
import { getAlephiumTokenWrappedInfo } from "../utils/alephium";
import { Algodv2 } from "algosdk";
import { useAlephiumWallet } from "./useAlephiumWallet";
import { errorDataWrapper, fetchDataWrapper, receiveDataWrapper } from "../store/helpers";

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
  const { provider } = useEthereumProvider();
  const isRecovery = useSelector(
    nft ? selectNFTIsRecovery : selectTransferIsRecovery
  );
  const alphWallet = useAlephiumWallet()
  useEffect(() => {
    if (isRecovery) {
      return;
    }
    let cancelled = false;
    (async () => {
      if (isEVMChain(sourceChain) && provider && sourceAsset) {
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
            dispatch(setSourceWormholeWrappedInfo(errorDataWrapper(`Failed to get source asset info from ${coalesceChainName(sourceChain)}, error: ${e}`)));
          }
        }
      }
      if (sourceChain === CHAIN_ID_SOLANA && sourceAsset) {
        try {
          dispatch(setSourceWormholeWrappedInfo(fetchDataWrapper()));
          const connection = new Connection(SOLANA_HOST, "confirmed");
          const wrappedInfo = makeStateSafe(
            await (nft
              ? getOriginalAssetSolNFT(
                  connection,
                  SOL_NFT_BRIDGE_ADDRESS,
                  sourceAsset
                )
              : getOriginalAssetSol(
                  connection,
                  SOL_TOKEN_BRIDGE_ADDRESS,
                  sourceAsset
                ))
          );
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(receiveDataWrapper(wrappedInfo)));
          }
        } catch (e) {
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(errorDataWrapper(`Failed to get source asset info from solana, error: ${e}`)));
          }
        }
      }
      if (sourceChain === CHAIN_ID_TERRA && sourceAsset) {
        try {
          dispatch(setSourceWormholeWrappedInfo(fetchDataWrapper()));
          const lcd = new LCDClient(TERRA_HOST);
          const wrappedInfo = makeStateSafe(
            await getOriginalAssetTerra(lcd, sourceAsset)
          );
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(receiveDataWrapper(wrappedInfo)));
          }
        } catch (e) {
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(errorDataWrapper(`Failed to get source asset info from terra, error: ${e}`)));
          }
        }
      }
      if (sourceChain === CHAIN_ID_ALEPHIUM && sourceAsset && !!alphWallet) {
        try {
          dispatch(setSourceWormholeWrappedInfo(fetchDataWrapper()));
          const wrappedInfo = await getAlephiumTokenInfo(alphWallet.nodeProvider, sourceAsset)
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(receiveDataWrapper(wrappedInfo)))
          }
        } catch (e) {
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(errorDataWrapper(`Failed to get source asset info from alephium, error: ${e}`)));
          }
        }
      }
      if (sourceChain === CHAIN_ID_ALGORAND && sourceAsset) {
        try {
          dispatch(setSourceWormholeWrappedInfo(fetchDataWrapper()));
          const algodClient = new Algodv2(
            ALGORAND_HOST.algodToken,
            ALGORAND_HOST.algodServer,
            ALGORAND_HOST.algodPort
          );
          const wrappedInfo = makeStateSafe(
            await getOriginalAssetAlgorand(
              algodClient,
              ALGORAND_TOKEN_BRIDGE_ID,
              BigInt(sourceAsset)
            )
          );
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(receiveDataWrapper(wrappedInfo)));
          }
        } catch (e) {
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(errorDataWrapper(`Failed to get source asset info from algorand, error: ${e}`)));
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
    provider,
    alphWallet,
    nft,
    setSourceWormholeWrappedInfo,
    tokenId,
  ]);
}

export default useCheckIfWormholeWrapped;

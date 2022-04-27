import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  getOriginalAssetEth,
  getOriginalAssetSol,
  getOriginalAssetTerra,
  isEVMChain,
  toAlphContractAddress,
  uint8ArrayToHex,
  WormholeWrappedInfo,
} from "@certusone/wormhole-sdk";
import {
  getOriginalAssetEth as getOriginalAssetEthNFT,
  getOriginalAssetSol as getOriginalAssetSolNFT,
} from "@certusone/wormhole-sdk/lib/esm/nft_bridge";
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
  ALEPHIUM_GROUP_INDEX,
  ALEPHIUM_HOST,
  ALEPHIUM_TOKEN_WRAPPER_CODE_HASH,
  getNFTBridgeAddressForChain,
  getTokenBridgeAddressForChain,
  SOLANA_HOST,
  SOL_NFT_BRIDGE_ADDRESS,
  SOL_TOKEN_BRIDGE_ADDRESS,
  TERRA_HOST,
} from "../utils/consts";
import { CliqueClient } from "alephium-web3";
import { ValByteVec, ValU256 } from 'alephium-web3/api/alephium';

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

async function getAlephiumTokenInfo(tokenId: string): Promise<StateSafeWormholeWrappedInfo> {
  const tokenAddress = toAlphContractAddress(tokenId)
  const client = new CliqueClient({baseUrl: ALEPHIUM_HOST})
  return client
    .contracts
    .getContractsAddressState(tokenAddress, {group: ALEPHIUM_GROUP_INDEX})
    .then(response => {
      if (response.data.artifactId === ALEPHIUM_TOKEN_WRAPPER_CODE_HASH) {
        const originalAsset = (response.data.fields[4] as ValByteVec).value
        return {
          isWrapped: true,
          chainId: parseInt((response.data.fields[3] as ValU256).value) as ChainId,
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
    })
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
  useEffect(() => {
    if (isRecovery) {
      return;
    }
    // TODO: loading state, error state
    let cancelled = false;
    (async () => {
      if (isEVMChain(sourceChain) && provider && sourceAsset) {
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
          dispatch(setSourceWormholeWrappedInfo(wrappedInfo));
        }
      }
      if (sourceChain === CHAIN_ID_SOLANA && sourceAsset) {
        try {
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
            dispatch(setSourceWormholeWrappedInfo(wrappedInfo));
          }
        } catch (e) {}
      }
      if (sourceChain === CHAIN_ID_TERRA && sourceAsset) {
        try {
          const lcd = new LCDClient(TERRA_HOST);
          const wrappedInfo = makeStateSafe(
            await getOriginalAssetTerra(lcd, sourceAsset)
          );
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(wrappedInfo));
          }
        } catch (e) {}
      }
      if (sourceChain === CHAIN_ID_ALEPHIUM && sourceAsset) {
        try {
          const wrappedInfo = await getAlephiumTokenInfo(sourceAsset)
          if (!cancelled) {
            dispatch(setSourceWormholeWrappedInfo(wrappedInfo))
          }
        } catch (e) {
          console.log("get alephium token info failed, error: " + JSON.stringify(e))
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
    nft,
    setSourceWormholeWrappedInfo,
    tokenId,
  ]);
}

export default useCheckIfWormholeWrapped;

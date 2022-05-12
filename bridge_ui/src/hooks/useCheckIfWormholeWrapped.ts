import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_TERRA,
  getOriginalAssetEth,
  getOriginalAssetTerra,
  isEVMChain,
  toAlphContractAddress,
  uint8ArrayToHex,
  WormholeWrappedInfo,
} from "@certusone/wormhole-sdk";
import {
  getOriginalAssetEth as getOriginalAssetEthNFT,
} from "@certusone/wormhole-sdk/lib/esm/nft_bridge";
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
  ALEPHIUM_TOKEN_WRAPPER_CODE_HASH,
  getNFTBridgeAddressForChain,
  getTokenBridgeAddressForChain,
  TERRA_HOST,
} from "../utils/consts";
import { ValByteVec, ValU256 } from 'alephium-web3/api/alephium';
import { AlephiumWalletSigner, useAlephiumWallet } from "../contexts/AlephiumWalletContext";

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

async function getAlephiumTokenInfo(signer: AlephiumWalletSigner, tokenId: string): Promise<StateSafeWormholeWrappedInfo> {
  const tokenAddress = toAlphContractAddress(tokenId)
  return signer.client
    .contracts
    .getContractsAddressState(tokenAddress, {group: signer.account.group})
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
  const { signer: alphSigner } = useAlephiumWallet()
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
      if (sourceChain === CHAIN_ID_ALEPHIUM && sourceAsset && !!alphSigner) {
        try {
          const wrappedInfo = await getAlephiumTokenInfo(alphSigner, sourceAsset)
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
    alphSigner,
    nft,
    setSourceWormholeWrappedInfo,
    tokenId,
  ]);
}

export default useCheckIfWormholeWrapped;

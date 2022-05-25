import {
  canonicalAddress,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_TERRA,
  isEVMChain,
  uint8ArrayToHex,
} from "@certusone/wormhole-sdk";
import { arrayify, zeroPad } from "@ethersproject/bytes";
import { useConnectedWallet } from "@terra-money/wallet-provider";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAlephiumWallet } from "../contexts/AlephiumWalletContext";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { setTargetAddressHex as setNFTTargetAddressHex } from "../store/nftSlice";
import {
  selectNFTTargetAsset,
  selectNFTTargetChain,
  selectTransferTargetAsset,
  selectTransferTargetChain,
  selectTransferTargetParsedTokenAccount,
} from "../store/selectors";
import { setTargetAddressHex as setTransferTargetAddressHex } from "../store/transferSlice";
import * as base58 from 'bs58';

function useSyncTargetAddress(shouldFire: boolean, nft?: boolean) {
  const dispatch = useDispatch();
  const targetChain = useSelector(
    nft ? selectNFTTargetChain : selectTransferTargetChain
  );
  const { signerAddress } = useEthereumProvider();
  const targetAsset = useSelector(
    nft ? selectNFTTargetAsset : selectTransferTargetAsset
  );
  const targetParsedTokenAccount = useSelector(
    selectTransferTargetParsedTokenAccount
  );
  const targetTokenAccountPublicKey = targetParsedTokenAccount?.publicKey;
  const terraWallet = useConnectedWallet();
  const { signer: alphSigner } = useAlephiumWallet();
  const setTargetAddressHex = nft
    ? setNFTTargetAddressHex
    : setTransferTargetAddressHex;
  useEffect(() => {
    if (shouldFire) {
      if (isEVMChain(targetChain) && signerAddress) {
        dispatch(
          setTargetAddressHex(
            uint8ArrayToHex(zeroPad(arrayify(signerAddress), 32))
          )
        );
      } else if (
        targetChain === CHAIN_ID_TERRA &&
        terraWallet &&
        terraWallet.walletAddress
      ) {
        dispatch(
          setTargetAddressHex(
            uint8ArrayToHex(
              zeroPad(canonicalAddress(terraWallet.walletAddress), 32)
            )
          )
        );
      } else if(targetChain === CHAIN_ID_ALEPHIUM && alphSigner) {
        dispatch(setTargetAddressHex(uint8ArrayToHex(base58.decode(alphSigner.account.address).slice(1))))
      } else {
        dispatch(setTargetAddressHex(undefined));
      }
      return () => {};
    }
  }, [
    dispatch,
    shouldFire,
    targetChain,
    signerAddress,
    targetAsset,
    targetTokenAccountPublicKey,
    terraWallet,
    alphSigner,
    nft,
    setTargetAddressHex,
  ]);
}

export default useSyncTargetAddress;

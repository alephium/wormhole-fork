import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_SOLANA,
  isEVMChain,
  uint8ArrayToHex,
} from "@alephium/wormhole-sdk";
import { arrayify, zeroPad } from "@ethersproject/bytes";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  Token,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey } from "@solana/web3.js";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAlgorandContext } from "@alephium/bridge-widget";
import { useEthereumProvider } from "@alephium/bridge-widget";
import { useSolanaWallet } from "@alephium/bridge-widget";
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
import { decodeAddress } from "algosdk";
import { useWallet } from "@alephium/web3-react";

function useSyncTargetAddress(shouldFire: boolean, nft?: boolean) {
  const dispatch = useDispatch();
  const targetChain = useSelector(
    nft ? selectNFTTargetChain : selectTransferTargetChain
  );
  const { signerAddress } = useEthereumProvider();
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const targetAsset = useSelector(
    nft ? selectNFTTargetAsset : selectTransferTargetAsset
  );
  const targetParsedTokenAccount = useSelector(
    selectTransferTargetParsedTokenAccount
  );
  const targetTokenAccountPublicKey = targetParsedTokenAccount?.publicKey;
  const alphWallet = useWallet();
  const { accounts: algoAccounts } = useAlgorandContext();
  const setTargetAddressHex = nft
    ? setNFTTargetAddressHex
    : setTransferTargetAddressHex;
  useEffect(() => {
    if (shouldFire) {
      let cancelled = false;
      if (isEVMChain(targetChain) && signerAddress) {
        dispatch(
          setTargetAddressHex(
            uint8ArrayToHex(arrayify(signerAddress))
          )
        );
      }
      // TODO: have the user explicitly select an account on solana
      else if (
        !nft && // only support existing, non-derived token accounts for token transfers (nft flow doesn't check balance)
        targetChain === CHAIN_ID_SOLANA &&
        targetTokenAccountPublicKey
      ) {
        // use the target's TokenAccount if it exists
        dispatch(
          setTargetAddressHex(
            uint8ArrayToHex(
              zeroPad(new PublicKey(targetTokenAccountPublicKey).toBytes(), 32)
            )
          )
        );
      } else if (targetChain === CHAIN_ID_SOLANA && solPK && targetAsset) {
        // otherwise, use the associated token account (which we create in the case it doesn't exist)
        (async () => {
          try {
            const associatedTokenAccount =
              await Token.getAssociatedTokenAddress(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                new PublicKey(targetAsset), // this might error
                solPK
              );
            if (!cancelled) {
              dispatch(
                setTargetAddressHex(
                  uint8ArrayToHex(zeroPad(associatedTokenAccount.toBytes(), 32))
                )
              );
            }
          } catch (e) {
            if (!cancelled) {
              dispatch(setTargetAddressHex(undefined));
            }
          }
        })();
      } else if(
        targetChain === CHAIN_ID_ALEPHIUM &&
        alphWallet.connectionStatus === 'connected' &&
        alphWallet.account.address
      ) {
        dispatch(setTargetAddressHex(uint8ArrayToHex(base58.decode(alphWallet.account.address))))
      } else if (targetChain === CHAIN_ID_ALGORAND && algoAccounts[0]) {
        dispatch(
          setTargetAddressHex(
            uint8ArrayToHex(decodeAddress(algoAccounts[0].address).publicKey)
          )
        );
      } else {
        dispatch(setTargetAddressHex(undefined));
      }
      return () => {
        cancelled = true;
      };
    }
  }, [
    dispatch,
    shouldFire,
    targetChain,
    signerAddress,
    solPK,
    targetAsset,
    targetTokenAccountPublicKey,
    alphWallet,
    nft,
    setTargetAddressHex,
    algoAccounts,
  ]);
}

export default useSyncTargetAddress;

import { CHAIN_ID_ALEPHIUM, CHAIN_ID_ALGORAND, CHAIN_ID_SOLANA, isEVMChain } from "@alephium/wormhole-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { formatUnits } from "ethers/lib/utils";
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAlgorandContext } from "../contexts/AlgorandWalletContext";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import {
  selectTransferTargetAsset,
  selectTransferTargetAssetWrapper,
  selectTransferTargetChain,
} from "../store/selectors";
import { setTargetParsedTokenAccount } from "../store/transferSlice";
import {
  ALGORAND_HOST,
  getEvmChainId,
  SOLANA_HOST
} from "../utils/consts";
import { createParsedTokenAccount } from "./useGetSourceParsedTokenAccounts";
import useMetadata from "./useMetadata";
import { Algodv2 } from "algosdk";
import { useWallet } from "@alephium/web3-react";

function useGetTargetParsedTokenAccounts() {
  const dispatch = useDispatch();
  const targetChain = useSelector(selectTransferTargetChain);
  const targetAsset = useSelector(selectTransferTargetAsset);
  const targetAssetWrapper = useSelector(selectTransferTargetAssetWrapper)
  const targetAssetArrayed = useMemo(
    () => (targetAsset ? [targetAsset] : []),
    [targetAsset]
  );
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const alphWallet = useWallet();
  const {
    provider,
    signerAddress,
    chainId: evmChainId,
  } = useEthereumProvider();
  const walletAddress = isEVMChain(targetChain)
    ? signerAddress
    : targetChain === CHAIN_ID_ALEPHIUM
    ? alphWallet?.account?.address
    : undefined;
  const hasCorrectEvmNetwork = evmChainId === getEvmChainId(targetChain);
  const { accounts: algoAccounts } = useAlgorandContext();
  const metadata = useMetadata(targetChain, targetAssetArrayed, true, walletAddress);
  const tokenName =
    (targetAsset && metadata.data?.get(targetAsset)?.tokenName) || undefined;
  const symbol =
    (targetAsset && metadata.data?.get(targetAsset)?.symbol) || undefined;
  const logo =
    (targetAsset && metadata.data?.get(targetAsset)?.logo) || undefined;
  const decimals =
    (targetAsset && metadata.data?.get(targetAsset)?.decimals) || undefined;
  const balance =
    (targetAsset && metadata.data?.get(targetAsset)?.balances) || undefined
  const hasResolvedMetadata = metadata.data || metadata.error;
  useEffect(() => {
    // targetParsedTokenAccount is cleared on setTargetAsset, but we need to clear it on wallet changes too
    dispatch(setTargetParsedTokenAccount(undefined));
    const targetAsset = targetAssetWrapper.data?.address
    if (!targetAsset || !hasResolvedMetadata) {
      return;
    }
    let cancelled = false;

    if (targetChain === CHAIN_ID_ALEPHIUM && alphWallet.connectionStatus === 'connected') {
        if (!cancelled && decimals !== undefined) {
          const balanceStr = balance?.toString() || '0'
          const uiAmount = formatUnits(balanceStr, decimals)
          dispatch(
            setTargetParsedTokenAccount(
              createParsedTokenAccount(
                alphWallet.account.address,
                targetAsset,
                balanceStr,
                decimals,
                Number(uiAmount),
                uiAmount,
                symbol,
                tokenName,
                logo
              )
            )
          )
        }
    }
    if (targetChain === CHAIN_ID_SOLANA && solPK) {
      let mint;
      try {
        mint = new PublicKey(targetAsset);
      } catch (e) {
        return;
      }
      const connection = new Connection(SOLANA_HOST, "confirmed");
      connection
        .getParsedTokenAccountsByOwner(solPK, { mint })
        .then(({ value }) => {
          if (!cancelled) {
            if (value.length) {
              dispatch(
                setTargetParsedTokenAccount(
                  createParsedTokenAccount(
                    value[0].pubkey.toString(),
                    value[0].account.data.parsed?.info?.mint,
                    value[0].account.data.parsed?.info?.tokenAmount?.amount,
                    value[0].account.data.parsed?.info?.tokenAmount?.decimals,
                    value[0].account.data.parsed?.info?.tokenAmount?.uiAmount,
                    value[0].account.data.parsed?.info?.tokenAmount
                      ?.uiAmountString,
                    symbol,
                    tokenName,
                    logo
                  )
                )
              );
            } else {
              // TODO: error state
            }
          }
        })
        .catch(() => {
          if (!cancelled) {
            // TODO: error state
          }
        });
    }
    if (
      isEVMChain(targetChain) &&
      provider &&
      signerAddress &&
      hasCorrectEvmNetwork
    ) {
      if (!cancelled && decimals !== undefined) {
        const balanceStr = balance?.toString() || '0'
        const uiAmount = formatUnits(balanceStr, decimals)
        dispatch(
          setTargetParsedTokenAccount(
            // TODO: verify accuracy
            createParsedTokenAccount(
              signerAddress,
              targetAsset,
              balanceStr,
              decimals,
              Number(uiAmount),
              uiAmount,
              symbol,
              tokenName,
              logo
            )
          )
        );
      }
    }
    if (
      targetChain === CHAIN_ID_ALGORAND &&
      algoAccounts[0] &&
      decimals !== undefined
    ) {
      const algodClient = new Algodv2(
        ALGORAND_HOST.algodToken,
        ALGORAND_HOST.algodServer,
        ALGORAND_HOST.algodPort
      );
      try {
        const tokenId = BigInt(targetAsset);
        algodClient
          .accountInformation(algoAccounts[0].address)
          .do()
          .then((accountInfo) => {
            let balance = 0;
            if (tokenId === BigInt(0)) {
              balance = accountInfo.amount;
            } else {
              let ret = 0;
              const assets: Array<any> = accountInfo.assets;
              assets.forEach((asset) => {
                if (tokenId === BigInt(asset["asset-id"])) {
                  ret = asset.amount;
                  return;
                }
              });
              balance = ret;
            }
            dispatch(
              setTargetParsedTokenAccount(
                createParsedTokenAccount(
                  algoAccounts[0].address,
                  targetAsset,
                  balance.toString(),
                  decimals,
                  Number(formatUnits(balance, decimals)),
                  formatUnits(balance, decimals),
                  symbol,
                  tokenName,
                  logo
                )
              )
            );
          })
          .catch(() => {
            if (!cancelled) {
              // TODO: error state
            }
          });
      } catch (e) {
        if (!cancelled) {
          // TODO: error state
        }
      }
    }
    return () => {
      cancelled = true;
    };
  }, [
    dispatch,
    targetAssetWrapper,
    targetChain,
    provider,
    signerAddress,
    solanaWallet,
    solPK,
    alphWallet,
    hasCorrectEvmNetwork,
    hasResolvedMetadata,
    symbol,
    tokenName,
    logo,
    algoAccounts,
    decimals,
    balance
  ]);
}

export default useGetTargetParsedTokenAccounts;

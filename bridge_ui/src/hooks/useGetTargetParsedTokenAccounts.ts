import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  isEVMChain,
  isNativeDenom,
  TokenImplementation__factory,
} from "alephium-wormhole-sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { LCDClient } from "@terra-money/terra.js";
import { useConnectedWallet } from "@terra-money/wallet-provider";
import { formatUnits } from "ethers/lib/utils";
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAlephiumWallet } from "../contexts/AlephiumWalletContext";
import { useAlgorandContext } from "../contexts/AlgorandWalletContext";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import {
  selectTransferTargetAsset,
  selectTransferTargetChain,
} from "../store/selectors";
import { ParsedTokenAccount, setTargetParsedTokenAccount } from "../store/transferSlice";
import { ALPH_TOKEN_ID, NodeProvider } from "@alephium/web3";
import { getAlephiumTokenInfo } from "../utils/alephium";
import {
  ALGORAND_HOST,
  getEvmChainId,
  SOLANA_HOST,
  TERRA_HOST,
} from "../utils/consts";
import { NATIVE_TERRA_DECIMALS } from "../utils/terra";
import { createParsedTokenAccount } from "./useGetSourceParsedTokenAccounts";
import useMetadata from "./useMetadata";
import { Algodv2 } from "algosdk";

async function getAlephiumTargetAsset(address: string, targetAsset: string, provider: NodeProvider): Promise<ParsedTokenAccount> {
  const utxos = await provider.addresses.getAddressesAddressUtxos(address)
  const now = Date.now()
  let balance = BigInt(0)
  if (targetAsset === ALPH_TOKEN_ID) {
    utxos.utxos.forEach(utxo => balance = balance + BigInt(utxo.amount))
  } else {
    utxos.utxos.forEach(utxo => {
      if (utxo.lockTime === undefined || now > utxo.lockTime) {
        utxo.tokens?.filter(t => t.id === targetAsset).forEach(t =>
          balance = balance + BigInt(t.amount)
        )
      }
    });
  }

  return getAlephiumTokenInfo(provider, targetAsset)
    .then((tokenInfo) => {
      if (typeof tokenInfo === 'undefined') {
        throw Error("failed to get alephium token info")
      }
      const uiAmount = formatUnits(balance, tokenInfo.decimals)
      return createParsedTokenAccount(
        address,
        targetAsset,
        balance.toString(),
        tokenInfo.decimals,
        parseFloat(uiAmount),
        uiAmount
      )
    })
}

function useGetTargetParsedTokenAccounts() {
  const dispatch = useDispatch();
  const targetChain = useSelector(selectTransferTargetChain);
  const targetAsset = useSelector(selectTransferTargetAsset);
  const targetAssetArrayed = useMemo(
    () => (targetAsset ? [targetAsset] : []),
    [targetAsset]
  );
  const metadata = useMetadata(targetChain, targetAssetArrayed);
  const tokenName =
    (targetAsset && metadata.data?.get(targetAsset)?.tokenName) || undefined;
  const symbol =
    (targetAsset && metadata.data?.get(targetAsset)?.symbol) || undefined;
  const logo =
    (targetAsset && metadata.data?.get(targetAsset)?.logo) || undefined;
  const decimals =
    (targetAsset && metadata.data?.get(targetAsset)?.decimals) || undefined;
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const terraWallet = useConnectedWallet();
  const { signer: alphSigner } = useAlephiumWallet();
  const {
    provider,
    signerAddress,
    chainId: evmChainId,
  } = useEthereumProvider();
  const hasCorrectEvmNetwork = evmChainId === getEvmChainId(targetChain);
  const { accounts: algoAccounts } = useAlgorandContext();
  const hasResolvedMetadata = metadata.data || metadata.error;
  useEffect(() => {
    // targetParsedTokenAccount is cleared on setTargetAsset, but we need to clear it on wallet changes too
    dispatch(setTargetParsedTokenAccount(undefined));
    if (!targetAsset || !hasResolvedMetadata) {
      return;
    }
    let cancelled = false;

    if (targetChain === CHAIN_ID_ALEPHIUM && !!alphSigner) {
      getAlephiumTargetAsset(alphSigner.account.address, targetAsset, alphSigner.nodeProvider)
        .then((target) => dispatch(setTargetParsedTokenAccount(target)))
        .catch(() => {
          if (!cancelled) {
            // TODO: error state
          }
        })
    }
    if (targetChain === CHAIN_ID_TERRA && terraWallet) {
      const lcd = new LCDClient(TERRA_HOST);
      if (isNativeDenom(targetAsset)) {
        lcd.bank
          .balance(terraWallet.walletAddress)
          .then(([coins]) => {
            const balance = coins.get(targetAsset)?.amount?.toString();
            if (balance && !cancelled) {
              dispatch(
                setTargetParsedTokenAccount(
                  createParsedTokenAccount(
                    "",
                    "",
                    balance,
                    NATIVE_TERRA_DECIMALS,
                    Number(formatUnits(balance, NATIVE_TERRA_DECIMALS)),
                    formatUnits(balance, NATIVE_TERRA_DECIMALS),
                    symbol,
                    tokenName,
                    logo
                  )
                )
              );
            }
          })
          .catch(() => {
            if (!cancelled) {
              // TODO: error state
            }
          });
      } else {
        lcd.wasm
          .contractQuery(targetAsset, {
            token_info: {},
          })
          .then((info: any) =>
            lcd.wasm
              .contractQuery(targetAsset, {
                balance: {
                  address: terraWallet.walletAddress,
                },
              })
              .then((balance: any) => {
                if (balance && info && !cancelled) {
                  dispatch(
                    setTargetParsedTokenAccount(
                      createParsedTokenAccount(
                        "",
                        "",
                        balance.balance.toString(),
                        info.decimals,
                        Number(formatUnits(balance.balance, info.decimals)),
                        formatUnits(balance.balance, info.decimals),
                        symbol,
                        tokenName,
                        logo
                      )
                    )
                  );
                }
              })
          )
          .catch(() => {
            if (!cancelled) {
              // TODO: error state
            }
          });
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
      const token = TokenImplementation__factory.connect(targetAsset, provider);
      token
        .decimals()
        .then((decimals) => {
          token.balanceOf(signerAddress).then((n) => {
            if (!cancelled) {
              dispatch(
                setTargetParsedTokenAccount(
                  // TODO: verify accuracy
                  createParsedTokenAccount(
                    signerAddress,
                    token.address,
                    n.toString(),
                    decimals,
                    Number(formatUnits(n, decimals)),
                    formatUnits(n, decimals),
                    symbol,
                    tokenName,
                    logo
                  )
                )
              );
            }
          });
        })
        .catch(() => {
          if (!cancelled) {
            // TODO: error state
          }
        });
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
    targetAsset,
    targetChain,
    provider,
    signerAddress,
    solanaWallet,
    solPK,
    terraWallet,
    alphSigner,
    hasCorrectEvmNetwork,
    hasResolvedMetadata,
    symbol,
    tokenName,
    logo,
    algoAccounts,
    decimals,
  ]);
}

export default useGetTargetParsedTokenAccounts;

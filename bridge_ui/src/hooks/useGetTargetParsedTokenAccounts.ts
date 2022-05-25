import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_TERRA,
  isEVMChain,
  isNativeDenom,
  TokenImplementation__factory,
} from "@certusone/wormhole-sdk";
import { LCDClient } from "@terra-money/terra.js";
import { useConnectedWallet } from "@terra-money/wallet-provider";
import { formatUnits } from "ethers/lib/utils";
import { useEffect, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAlephiumWallet } from "../contexts/AlephiumWalletContext";
import { useEthereumProvider } from "../contexts/EthereumProviderContext";
import {
  selectTransferTargetAsset,
  selectTransferTargetChain,
} from "../store/selectors";
import { ParsedTokenAccount, setTargetParsedTokenAccount } from "../store/transferSlice";
import { getEvmChainId, TERRA_HOST } from "../utils/consts";
import { NATIVE_TERRA_DECIMALS } from "../utils/terra";
import { createParsedTokenAccount } from "./useGetSourceParsedTokenAccounts";
import useMetadata from "./useMetadata";
import { NodeProvider } from "alephium-web3";
import { getAlephiumTokenInfo } from "../utils/alephium";

async function getAlephiumTargetAsset(address: string, targetAsset: string, provider: NodeProvider): Promise<ParsedTokenAccount> {
  const utxos = await provider.addresses.getAddressesAddressUtxos(address)
  const now = Date.now()
  let balance = BigInt(0)
  utxos.utxos.forEach(utxo => {
    if (now > utxo.lockTime) {
      utxo.tokens.filter(t => t.id === targetAsset).forEach(t =>
        balance = balance + BigInt(t.amount)
      )
    }
  });

  const tokenInfo = await getAlephiumTokenInfo(provider, targetAsset)
  const uiAmount = formatUnits(balance, tokenInfo.decimals)
  return createParsedTokenAccount(
    address,
    targetAsset,
    balance.toString(),
    tokenInfo.decimals,
    parseFloat(uiAmount),
    uiAmount
  )
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
  const terraWallet = useConnectedWallet();
  const { signer: alphSigner } = useAlephiumWallet();
  const {
    provider,
    signerAddress,
    chainId: evmChainId,
  } = useEthereumProvider();
  const hasCorrectEvmNetwork = evmChainId === getEvmChainId(targetChain);
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
    return () => {
      cancelled = true;
    };
  }, [
    dispatch,
    targetAsset,
    targetChain,
    provider,
    signerAddress,
    terraWallet,
    alphSigner,
    hasCorrectEvmNetwork,
    hasResolvedMetadata,
    symbol,
    tokenName,
    logo,
  ]);
}

export default useGetTargetParsedTokenAccounts;

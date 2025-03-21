import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_ACALA,
  CHAIN_ID_ALGORAND,
  CHAIN_ID_AURORA,
  CHAIN_ID_AVAX,
  CHAIN_ID_BSC,
  CHAIN_ID_CELO,
  CHAIN_ID_ETH,
  CHAIN_ID_ETHEREUM_ROPSTEN,
  CHAIN_ID_FANTOM,
  CHAIN_ID_KARURA,
  CHAIN_ID_KLAYTN,
  CHAIN_ID_NEON,
  CHAIN_ID_OASIS,
  CHAIN_ID_POLYGON,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  isEVMChain,
  ethers_contracts,
  WSOL_ADDRESS,
  WSOL_DECIMALS,
  hexToUint8Array,
  getTokenPoolId
} from "@alephium/wormhole-sdk";
import { Dispatch } from "@reduxjs/toolkit";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useSnackbar } from "notistack";
import {
  AccountInfo,
  Connection,
  ParsedAccountData,
  PublicKey,
} from "@solana/web3.js";
import { Algodv2 } from "algosdk";
import { ethers } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useAlgorandContext } from "../contexts/AlgorandWalletContext";
import {
  Provider,
  useEthereumProvider,
} from "../contexts/EthereumProviderContext";
import { useSolanaWallet } from "../contexts/SolanaWalletContext";
import acalaIcon from "../icons/acala.svg";
import auroraIcon from "../icons/aurora.svg";
import avaxIcon from "../icons/avax.svg";
import bnbIcon from "../icons/bnb.svg";
import celoIcon from "../icons/celo.svg";
import ethIcon from "../icons/eth.svg";
import fantomIcon from "../icons/fantom.svg";
import karuraIcon from "../icons/karura.svg";
import klaytnIcon from "../icons/klaytn.svg";
import neonIcon from "../icons/neon.svg";
import oasisIcon from "../icons/oasis-network-rose-logo.svg";
import polygonIcon from "../icons/polygon.svg";
import {
  errorSourceParsedTokenAccounts as errorSourceParsedTokenAccountsNFT,
  fetchSourceParsedTokenAccounts as fetchSourceParsedTokenAccountsNFT,
  NFTParsedTokenAccount,
  receiveSourceParsedTokenAccounts as receiveSourceParsedTokenAccountsNFT,
  setSourceParsedTokenAccount as setSourceParsedTokenAccountNFT,
  setSourceParsedTokenAccounts as setSourceParsedTokenAccountsNFT,
  setSourceWalletAddress as setSourceWalletAddressNFT,
} from "../store/nftSlice";
import {
  selectNFTSourceChain,
  selectNFTSourceParsedTokenAccounts,
  selectNFTSourceWalletAddress,
  selectNFTTargetChain,
  selectSourceWalletAddress,
  selectTransferSourceChain,
  selectTransferSourceParsedTokenAccounts,
  selectTransferTargetChain,
} from "../store/selectors";
import {
  errorSourceParsedTokenAccounts,
  fetchSourceParsedTokenAccounts,
  ParsedTokenAccount,
  receiveSourceParsedTokenAccounts,
  setAmount,
  setSourceParsedTokenAccount,
  setSourceParsedTokenAccounts,
  setSourceWalletAddress,
} from "../store/transferSlice";
import {
  ACA_ADDRESS,
  ACA_DECIMALS,
  ALGORAND_HOST,
  ALGO_DECIMALS,
  KAR_ADDRESS,
  KAR_DECIMALS,
  logoOverrides,
  ROPSTEN_WETH_ADDRESS,
  ROPSTEN_WETH_DECIMALS,
  SOLANA_HOST,
  WAVAX_ADDRESS,
  WAVAX_DECIMALS,
  WBNB_ADDRESS,
  WBNB_DECIMALS,
  CELO_ADDRESS,
  CELO_DECIMALS,
  WETH_ADDRESS,
  WETH_AURORA_ADDRESS,
  WETH_AURORA_DECIMALS,
  WETH_DECIMALS,
  WFTM_ADDRESS,
  WFTM_DECIMALS,
  WKLAY_ADDRESS,
  WKLAY_DECIMALS,
  WMATIC_ADDRESS,
  WMATIC_DECIMALS,
  WNEON_ADDRESS,
  WNEON_DECIMALS,
  WROSE_ADDRESS,
  WROSE_DECIMALS,
  ALEPHIUM_BRIDGE_GROUP_INDEX,
  getTokenBridgeAddressForChain,
  ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID
} from "../utils/consts";
import {
  ExtractedMintInfo,
  extractMintInfo,
  getMultipleAccountsRPC,
} from "../utils/solana";
import { fetchSingleMetadata } from "./useAlgoMetadata";
import { ALPH_TOKEN_ID, NodeProvider } from "@alephium/web3";
import { getAvailableBalances } from "../utils/alephium";
import { getRegisteredTokens, getTokenLogoAndSymbol } from "../utils/tokens";
import { useWallet } from "@alephium/web3-react";
import { Alert } from "@material-ui/lab";
import parseError from "../utils/parseError";
import i18n from "../i18n";
import { useTranslation } from "react-i18next";

export function createParsedTokenAccount(
  publicKey: string,
  mintKey: string,
  amount: string,
  decimals: number,
  uiAmount: number,
  uiAmountString: string,
  symbol?: string,
  name?: string,
  logo?: string,
  isNativeAsset?: boolean
): ParsedTokenAccount {
  return {
    publicKey: publicKey,
    mintKey: mintKey,
    amount,
    decimals,
    uiAmount,
    uiAmountString,
    symbol,
    name,
    logo,
    isNativeAsset,
  };
}

export function createNFTParsedTokenAccount(
  publicKey: string,
  mintKey: string,
  amount: string,
  decimals: number,
  uiAmount: number,
  uiAmountString: string,
  tokenId: string,
  symbol?: string,
  name?: string,
  uri?: string,
  animation_url?: string,
  external_url?: string,
  image?: string,
  image_256?: string,
  nftName?: string,
  description?: string
): NFTParsedTokenAccount {
  return {
    publicKey,
    mintKey,
    amount,
    decimals,
    uiAmount,
    uiAmountString,
    tokenId,
    uri,
    animation_url,
    external_url,
    image,
    image_256,
    symbol,
    name,
    nftName,
    description,
  };
}

const createParsedTokenAccountFromInfo = (
  pubkey: PublicKey,
  item: AccountInfo<ParsedAccountData>
): ParsedTokenAccount => {
  return {
    publicKey: pubkey?.toString(),
    mintKey: item.data.parsed?.info?.mint?.toString(),
    amount: item.data.parsed?.info?.tokenAmount?.amount,
    decimals: item.data.parsed?.info?.tokenAmount?.decimals,
    uiAmount: item.data.parsed?.info?.tokenAmount?.uiAmount,
    uiAmountString: item.data.parsed?.info?.tokenAmount?.uiAmountString,
  };
};

const createParsedTokenAccountFromCovalent = (
  walletAddress: string,
  covalent: CovalentData
): ParsedTokenAccount => {
  return {
    publicKey: walletAddress,
    mintKey: covalent.contract_address,
    amount: covalent.balance,
    decimals: covalent.contract_decimals,
    uiAmount: Number(formatUnits(covalent.balance, covalent.contract_decimals)),
    uiAmountString: formatUnits(covalent.balance, covalent.contract_decimals),
    symbol: covalent.contract_ticker_symbol,
    name: covalent.contract_name,
    logo: logoOverrides.get(covalent.contract_address) || covalent.logo_url,
  };
};

const createNativeSolParsedTokenAccount = async (
  connection: Connection,
  walletAddress: string
) => {
  // const walletAddress = "H69q3Q8E74xm7swmMQpsJLVp2Q9JuBwBbxraAMX5Drzm" // known solana mainnet wallet with tokens
  const fetchAccounts = await getMultipleAccountsRPC(connection, [
    new PublicKey(walletAddress),
  ]);
  if (!fetchAccounts || !fetchAccounts.length || !fetchAccounts[0]) {
    return null;
  } else {
    return createParsedTokenAccount(
      walletAddress, //publicKey
      WSOL_ADDRESS, //Mint key
      fetchAccounts[0].lamports.toString(), //amount
      WSOL_DECIMALS, //decimals, 9
      parseFloat(formatUnits(fetchAccounts[0].lamports, WSOL_DECIMALS)),
      formatUnits(fetchAccounts[0].lamports, WSOL_DECIMALS).toString(),
      "SOL",
      "Solana",
      undefined, //TODO logo. It's in the solana token map, so we could potentially use that URL.
      true
    );
  }
};

const createNativeEthParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          WETH_ADDRESS, //Mint key, On the other side this will be WETH, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          WETH_DECIMALS, //Luckily both ETH and WETH have 18 decimals, so this should not be an issue.
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "ETH", //A white lie for display purposes
          "Ethereum", //A white lie for display purposes
          ethIcon,
          true //isNativeAsset
        );
      });
};

const createNativeEthRopstenParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          ROPSTEN_WETH_ADDRESS, //Mint key, On the other side this will be WETH, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          ROPSTEN_WETH_DECIMALS, //Luckily both ETH and WETH have 18 decimals, so this should not be an issue.
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "ETH", //A white lie for display purposes
          "Ethereum", //A white lie for display purposes
          ethIcon,
          true //isNativeAsset
        );
      });
};

const createNativeBscParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          WBNB_ADDRESS, //Mint key, On the other side this will be WBNB, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          WBNB_DECIMALS, //Luckily both BNB and WBNB have 18 decimals, so this should not be an issue.
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "BNB", //A white lie for display purposes
          "Binance Coin", //A white lie for display purposes
          bnbIcon,
          true //isNativeAsset
        );
      });
};

const createNativePolygonParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          WMATIC_ADDRESS, //Mint key, On the other side this will be WMATIC, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          WMATIC_DECIMALS, //Luckily both MATIC and WMATIC have 18 decimals, so this should not be an issue.
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "MATIC", //A white lie for display purposes
          "Matic", //A white lie for display purposes
          polygonIcon,
          true //isNativeAsset
        );
      });
};

const createNativeAvaxParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          WAVAX_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          WAVAX_DECIMALS,
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "AVAX", //A white lie for display purposes
          "Avalanche", //A white lie for display purposes
          avaxIcon,
          true //isNativeAsset
        );
      });
};

const createNativeOasisParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          WROSE_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          WROSE_DECIMALS,
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "ROSE", //A white lie for display purposes
          "Rose", //A white lie for display purposes
          oasisIcon,
          true //isNativeAsset
        );
      });
};

const createNativeAuroraParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          WETH_AURORA_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          WETH_AURORA_DECIMALS,
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "ETH", //A white lie for display purposes
          "Aurora ETH", //A white lie for display purposes
          auroraIcon,
          true //isNativeAsset
        );
      });
};

const createNativeFantomParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          WFTM_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          WFTM_DECIMALS,
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "FTM", //A white lie for display purposes
          "Fantom", //A white lie for display purposes
          fantomIcon,
          true //isNativeAsset
        );
      });
};

const createNativeKaruraParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : ethers_contracts.TokenImplementation__factory.connect(KAR_ADDRESS, provider)
        .balanceOf(signerAddress)
        .then((balance) => {
          const balanceInEth = ethers.utils.formatUnits(balance, KAR_DECIMALS);
          return createParsedTokenAccount(
            signerAddress, //public key
            KAR_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
            balance.toString(), //amount, in wei
            KAR_DECIMALS,
            parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "KAR", //A white lie for display purposes
            "KAR", //A white lie for display purposes
            karuraIcon,
            false //isNativeAsset
          );
        });
};

const createNativeAcalaParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : ethers_contracts.TokenImplementation__factory.connect(ACA_ADDRESS, provider)
        .balanceOf(signerAddress)
        .then((balance) => {
          const balanceInEth = ethers.utils.formatUnits(balance, ACA_DECIMALS);
          return createParsedTokenAccount(
            signerAddress, //public key
            ACA_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
            balance.toString(), //amount, in wei
            ACA_DECIMALS,
            parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "ACA", //A white lie for display purposes
            "ACA", //A white lie for display purposes
            acalaIcon,
            false //isNativeAsset
          );
        });
};

const createNativeKlaytnParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          WKLAY_ADDRESS, //Mint key, On the other side this will be wklay, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          WKLAY_DECIMALS,
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "KLAY", //A white lie for display purposes
          "KLAY", //A white lie for display purposes
          klaytnIcon,
          true //isNativeAsset
        );
      });
};

const createNativeCeloParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  // Celo has a "native asset" ERC-20
  // https://docs.celo.org/developer-guide/celo-for-eth-devs
  return !(provider && signerAddress)
    ? Promise.reject()
    : ethers_contracts.TokenImplementation__factory.connect(CELO_ADDRESS, provider)
        .balanceOf(signerAddress)
        .then((balance) => {
          const balanceInEth = ethers.utils.formatUnits(balance, CELO_DECIMALS);
          return createParsedTokenAccount(
            signerAddress, //public key
            CELO_ADDRESS, //Mint key, On the other side this will be wavax, so this is hopefully a white lie.
            balance.toString(), //amount, in wei
            CELO_DECIMALS,
            parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
            balanceInEth.toString(), //This is the actual display field, which has full precision.
            "CELO", //A white lie for display purposes
            "CELO", //A white lie for display purposes
            celoIcon,
            false //isNativeAsset
          );
        });
};

const createNativeNeonParsedTokenAccount = (
  provider: Provider,
  signerAddress: string | undefined
) => {
  return !(provider && signerAddress)
    ? Promise.reject()
    : provider.getBalance(signerAddress).then((balanceInWei) => {
        const balanceInEth = ethers.utils.formatEther(balanceInWei);
        return createParsedTokenAccount(
          signerAddress, //public key
          WNEON_ADDRESS, //Mint key, On the other side this will be wneon, so this is hopefully a white lie.
          balanceInWei.toString(), //amount, in wei
          WNEON_DECIMALS,
          parseFloat(balanceInEth), //This loses precision, but is a limitation of the current datamodel. This field is essentially deprecated
          balanceInEth.toString(), //This is the actual display field, which has full precision.
          "NEON", //A white lie for display purposes
          "NEON", //A white lie for display purposes
          neonIcon,
          true //isNativeAsset
        );
      });
};

export type CovalentData = {
  contract_decimals: number;
  contract_ticker_symbol: string;
  contract_name: string;
  contract_address: string;
  logo_url: string | undefined;
  balance: string;
  quote: number | undefined;
  quote_rate: number | undefined;
  nft_data?: CovalentNFTData[];
};

export type CovalentNFTExternalData = {
  animation_url: string | null;
  external_url: string | null;
  image: string;
  image_256: string;
  name: string;
  description: string;
};

export type CovalentNFTData = {
  token_id: string;
  token_balance: string;
  external_data: CovalentNFTExternalData;
  token_url: string;
};

export const getEVMAccounts = async (
  sourceChainId: ChainId,
  targetChainId: ChainId,
  signer: ethers.Signer,
  walletAddress: string
): Promise<CovalentData[]> => {
  try {
    const registeredTokens = await getRegisteredTokens()
    const filteredTokens = registeredTokens.filter((t) => t.tokenChain === sourceChainId || t.tokenChain === targetChainId)
    const promises = filteredTokens.map(async (token) => {
      try {
        const tokenId = token.tokenChain === sourceChainId
          ? token.nativeAddress
          : await ethers_contracts.BridgeImplementation__factory
              .connect(getTokenBridgeAddressForChain(sourceChainId), signer)
              .wrappedAsset(token.tokenChain, hexToUint8Array(token.tokenAddress))
        if (tokenId === ethers.constants.AddressZero) return undefined
        const tokenContract = ethers_contracts.ERC20__factory.connect(tokenId, signer)
        const amount = await tokenContract.balanceOf(walletAddress)
        return {
          tokenId: tokenId,
          balance: amount.toBigInt()
        }
      } catch (error) {
        console.log(`${i18n.t('Failed to get balance')}, ${i18n.t('token address')}: ${token.nativeAddress}, ${i18n.t('Error')}: ${error}`)
        return undefined
      }
    })
    const tokenAccounts: CovalentData[] = []
    const results = await Promise.all(promises)
    for (let index = 0; index < filteredTokens.length; index++) {
      const result = results[index]
      const token = filteredTokens[index]
      if (result === undefined || result.balance === BigInt(0)) {
        continue
      }
      if (tokenAccounts.find((t) => t.contract_address.toLowerCase() === result.tokenId.toLowerCase()) !== undefined) {
        continue
      }
      const info = await getTokenLogoAndSymbol(token.tokenChain, token.nativeAddress)
      tokenAccounts.push({
        contract_decimals: token.decimals,
        contract_ticker_symbol: info?.symbol ?? token.symbol,
        contract_name: token.name,
        contract_address: result.tokenId,
        logo_url: info?.logoURI ?? token.logo,
        balance: result.balance.toString(),
        quote: undefined,
        quote_rate: undefined
      })
    }
    return tokenAccounts
  } catch (error) {
    return Promise.reject(`${i18n.t('Unable to retrive your EVM tokens')}, ${i18n.t('Error')}: ${error}`)
  }
}

const getSolanaParsedTokenAccounts = async (
  walletAddress: string,
  dispatch: Dispatch,
  nft: boolean
) => {
  const connection = new Connection(SOLANA_HOST, "confirmed");
  dispatch(
    nft ? fetchSourceParsedTokenAccountsNFT() : fetchSourceParsedTokenAccounts()
  );
  try {
    //No matter what, we retrieve the spl tokens associated to this address.
    let splParsedTokenAccounts = await connection
      .getParsedTokenAccountsByOwner(new PublicKey(walletAddress), {
        programId: new PublicKey(TOKEN_PROGRAM_ID),
      })
      .then((result) => {
        return result.value.map((item) =>
          createParsedTokenAccountFromInfo(item.pubkey, item.account)
        );
      });

    // uncomment to test token account in picker, useful for debugging
    // splParsedTokenAccounts.push({
    //   amount: "1",
    //   decimals: 8,
    //   mintKey: "2Xf2yAXJfg82sWwdLUo2x9mZXy6JCdszdMZkcF1Hf4KV",
    //   publicKey: "2Xf2yAXJfg82sWwdLUo2x9mZXy6JCdszdMZkcF1Hf4KV",
    //   uiAmount: 1,
    //   uiAmountString: "1",
    //   isNativeAsset: false,
    // });

    if (nft) {
      //In the case of NFTs, we are done, and we set the accounts in redux
      dispatch(receiveSourceParsedTokenAccountsNFT(splParsedTokenAccounts));
    } else {
      //In the transfer case, we also pull the SOL balance of the wallet, and prepend it at the beginning of the list.
      const nativeAccount = await createNativeSolParsedTokenAccount(
        connection,
        walletAddress
      );
      if (nativeAccount !== null) {
        splParsedTokenAccounts.unshift(nativeAccount);
      }
      dispatch(receiveSourceParsedTokenAccounts(splParsedTokenAccounts));
    }
  } catch (e) {
    console.error(e);
    dispatch(
      nft
        ? errorSourceParsedTokenAccountsNFT("Failed to load NFT metadata")
        : errorSourceParsedTokenAccounts("Failed to load token metadata.")
    );
  }
};

const getAlgorandParsedTokenAccounts = async (
  walletAddress: string,
  dispatch: Dispatch,
  nft: boolean
) => {
  if (nft) {
    // not supported yet
    return;
  }
  dispatch(
    nft ? fetchSourceParsedTokenAccountsNFT() : fetchSourceParsedTokenAccounts()
  );
  try {
    const algodClient = new Algodv2(
      ALGORAND_HOST.algodToken,
      ALGORAND_HOST.algodServer,
      ALGORAND_HOST.algodPort
    );
    const accountInfo = await algodClient
      .accountInformation(walletAddress)
      .do();
    const parsedTokenAccounts: ParsedTokenAccount[] = [];
    parsedTokenAccounts.push(
      createParsedTokenAccount(
        walletAddress, //publicKey
        "0", //asset ID
        accountInfo.amount, //amount
        ALGO_DECIMALS,
        parseFloat(formatUnits(accountInfo.amount, ALGO_DECIMALS)),
        formatUnits(accountInfo.amount, ALGO_DECIMALS).toString(),
        "ALGO",
        "Algo",
        undefined, //TODO logo
        true
      )
    );
    for (const asset of accountInfo.assets) {
      const assetId = asset["asset-id"];
      const amount = asset.amount;
      const metadata = await fetchSingleMetadata(assetId, algodClient);
      parsedTokenAccounts.push(
        createParsedTokenAccount(
          walletAddress,
          assetId.toString(),
          amount,
          metadata.decimals,
          parseFloat(formatUnits(amount, metadata.decimals)),
          formatUnits(amount, metadata.decimals).toString(),
          metadata.symbol,
          metadata.tokenName,
          undefined,
          false
        )
      );
    }
    dispatch(receiveSourceParsedTokenAccounts(parsedTokenAccounts));
  } catch (e) {
    console.error(e);
    dispatch(
      nft
        ? errorSourceParsedTokenAccountsNFT("Failed to load NFT metadata")
        : errorSourceParsedTokenAccounts("Failed to load token metadata.")
    );
  }
};

const getAlephiumParsedTokenAccounts = async (targetChainId: ChainId, address: string, provider: NodeProvider) => {
  try {
    const balances = await getAvailableBalances(provider, address)
    const registeredTokens = await getRegisteredTokens()
    const filteredTokens = registeredTokens.filter((t) => t.tokenChain === CHAIN_ID_ALEPHIUM || t.tokenChain === targetChainId)
    const tokenAccounts: ParsedTokenAccount[] = []
    for (const token of filteredTokens) {
      const localTokenId = token.tokenChain === CHAIN_ID_ALEPHIUM
        ? token.nativeAddress
        : getTokenPoolId(ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID, token.tokenChain, token.tokenAddress, ALEPHIUM_BRIDGE_GROUP_INDEX)
      const amount = balances.get(localTokenId.toLowerCase())
      if (amount === undefined) continue

      const info = await getTokenLogoAndSymbol(token.tokenChain, token.nativeAddress)
      const uiAmount = formatUnits(amount, token.decimals)
      tokenAccounts.push(createParsedTokenAccount(
        address,
        localTokenId,
        amount.toString(),
        token.decimals,
        parseFloat(uiAmount),
        uiAmount,
        info?.symbol ?? token.symbol,
        token.name,
        info?.logoURI ?? token.logo,
        localTokenId === ALPH_TOKEN_ID
      ))
    }
    return { tokenAccounts, balances}
  } catch (error) {
    const errMsg = `${i18n.t('Failed to load alephium token metadata')}: ${error}`
    console.error(errMsg)
    throw new Error(errMsg)
  }
}

/**
 * Fetches the balance of an asset for the connected wallet
 * This should handle every type of chain in the future, but only reads the Transfer state.
 */
function useGetAvailableTokens(nft: boolean = false) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { enqueueSnackbar } = useSnackbar();

  const tokenAccounts = useSelector(
    nft
      ? selectNFTSourceParsedTokenAccounts
      : selectTransferSourceParsedTokenAccounts
  );

  const lookupChain = useSelector(
    nft ? selectNFTSourceChain : selectTransferSourceChain
  );
  const targetChain = useSelector(
    nft ? selectNFTTargetChain : selectTransferTargetChain
  )
  const [selectedTargetChain, setSelectedTargetChain] = useState<ChainId>(targetChain)
  const solanaWallet = useSolanaWallet();
  const solPK = solanaWallet?.publicKey;
  const { provider, signerAddress, signer } = useEthereumProvider();
  const { accounts: algoAccounts } = useAlgorandContext();
  const alphWallet = useWallet()

  const [covalent, setCovalent] = useState<CovalentData[] | undefined>()
  const [covalentLoading, setCovalentLoading] = useState(false);
  const [covalentError, setCovalentError] = useState<string | undefined>(
    undefined
  );

  const [alphTokens, setAlphTokens] = useState<ParsedTokenAccount[] | undefined>()
  const [alphBalances, setAlphBalances] = useState<Map<string, bigint>>(new Map())
  const [alphTokenLoading, setAlphTokenLoading] = useState(false)
  const [alphTokenError, setAlphTokenError] = useState<string>()

  const [ethNativeAccount, setEthNativeAccount] = useState<any>(undefined);
  const [ethNativeAccountLoading, setEthNativeAccountLoading] = useState(false);
  const [ethNativeAccountError, setEthNativeAccountError] = useState<
    string | undefined
  >(undefined);

  const [solanaMintAccounts, setSolanaMintAccounts] = useState<
    Map<string, ExtractedMintInfo | null> | undefined
  >(undefined);
  const [solanaMintAccountsLoading, setSolanaMintAccountsLoading] =
    useState(false);
  const [solanaMintAccountsError, setSolanaMintAccountsError] = useState<
    string | undefined
  >(undefined);

  const selectedSourceWalletAddress = useSelector(
    nft ? selectNFTSourceWalletAddress : selectSourceWalletAddress
  );
  const currentSourceWalletAddress: string | undefined = isEVMChain(lookupChain)
    ? signerAddress
    : lookupChain === CHAIN_ID_SOLANA
    ? solPK?.toString()
    : lookupChain === CHAIN_ID_ALGORAND
    ? algoAccounts[0]?.address
    : lookupChain === CHAIN_ID_ALEPHIUM
    ? alphWallet?.account?.address
    : undefined;

  const resetSourceAccounts = useCallback(() => {
    dispatch(
      nft
        ? setSourceWalletAddressNFT(undefined)
        : setSourceWalletAddress(undefined)
    );
    dispatch(
      nft
        ? setSourceParsedTokenAccountNFT(undefined)
        : setSourceParsedTokenAccount(undefined)
    );
    dispatch(
      nft
        ? setSourceParsedTokenAccountsNFT(undefined)
        : setSourceParsedTokenAccounts(undefined)
    );
    !nft && dispatch(setAmount(""));
    setCovalent(undefined); //These need to be included in the reset because they have balances on them.
    setCovalentLoading(false);
    setCovalentError("");

    setAlphTokens(undefined)
    setAlphTokenLoading(false)
    setAlphTokenError(undefined)

    setEthNativeAccount(undefined);
    setEthNativeAccountLoading(false);
    setEthNativeAccountError("");
  }, [setCovalent, dispatch, nft]);

  //TODO this useEffect could be somewhere else in the codebase
  //It resets the SourceParsedTokens accounts when the wallet changes
  useEffect(() => {
    const sourceChainChanged =
      selectedSourceWalletAddress !== undefined &&
      currentSourceWalletAddress !== undefined &&
      currentSourceWalletAddress !== selectedSourceWalletAddress
    const targetChainChanged = targetChain !== selectedTargetChain
    if (sourceChainChanged || targetChainChanged) {
      resetSourceAccounts();
    }
    if (targetChainChanged) {
      setSelectedTargetChain(targetChain)
    }
  }, [
    targetChain,
    selectedTargetChain,
    selectedSourceWalletAddress,
    currentSourceWalletAddress,
    dispatch,
    resetSourceAccounts,
  ]);

  //Solana accountinfos load
  useEffect(() => {
    if (lookupChain === CHAIN_ID_SOLANA && solPK) {
      if (
        !(tokenAccounts.data || tokenAccounts.isFetching || tokenAccounts.error)
      ) {
        getSolanaParsedTokenAccounts(solPK.toString(), dispatch, nft);
      }
    }

    return () => {};
  }, [dispatch, solanaWallet, lookupChain, solPK, tokenAccounts, nft]);

  //Solana Mint Accounts lookup
  useEffect(() => {
    if (lookupChain !== CHAIN_ID_SOLANA || !tokenAccounts.data?.length) {
      return () => {};
    }

    let cancelled = false;
    setSolanaMintAccountsLoading(true);
    setSolanaMintAccountsError(undefined);
    const mintAddresses = tokenAccounts.data.map((x) => x.mintKey);
    //This is a known wormhole v1 token on testnet
    // mintAddresses.push("4QixXecTZ4zdZGa39KH8gVND5NZ2xcaB12wiBhE4S7rn");
    //SOLT devnet token
    // mintAddresses.push("2WDq7wSs9zYrpx2kbHDA4RUTRch2CCTP6ZWaH4GNfnQQ");
    // bad monkey "NFT"
    // mintAddresses.push("5FJeEJR8576YxXFdGRAu4NBBFcyfmtjsZrXHSsnzNPdS");
    // degenerate monkey NFT
    // mintAddresses.push("EzYsbigNNGbNuANRJ3mnnyJYU2Bk7mBYVsxuonUwAX7r");

    const connection = new Connection(SOLANA_HOST, "confirmed");
    getMultipleAccountsRPC(
      connection,
      mintAddresses.map((x) => new PublicKey(x))
    ).then(
      (results) => {
        if (!cancelled) {
          const output = new Map<string, ExtractedMintInfo | null>();

          results.forEach((result, index) =>
            output.set(
              mintAddresses[index],
              (result && extractMintInfo(result)) || null
            )
          );

          setSolanaMintAccounts(output);
          setSolanaMintAccountsLoading(false);
        }
      },
      (error) => {
        if (!cancelled) {
          setSolanaMintAccounts(undefined);
          setSolanaMintAccountsLoading(false);
          setSolanaMintAccountsError(
            "Could not retrieve Solana mint accounts."
          );
        }
      }
    );

    return () => (cancelled = true);
  }, [tokenAccounts.data, lookupChain]);

  //Ethereum native asset load
  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_ETH &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeEthParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your ETH balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  //Ethereum (Ropsten) native asset load
  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_ETHEREUM_ROPSTEN &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeEthRopstenParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your ETH balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  //Binance Smart Chain native asset load
  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_BSC &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeBscParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your BNB balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  //Polygon native asset load
  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_POLYGON &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativePolygonParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your MATIC balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  //TODO refactor all these into an isEVM effect
  //avax native asset load
  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_AVAX &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeAvaxParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your AVAX balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_OASIS &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeOasisParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your Oasis balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_AURORA &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeAuroraParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your Fantom balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_FANTOM &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeFantomParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your Fantom balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_KARURA &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeKaruraParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your Karura balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_ACALA &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeAcalaParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your Acala balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_KLAYTN &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeKlaytnParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your Klaytn balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_CELO &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeCeloParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your Celo balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  useEffect(() => {
    let cancelled = false;
    if (
      signerAddress &&
      lookupChain === CHAIN_ID_NEON &&
      !ethNativeAccount &&
      !nft
    ) {
      setEthNativeAccountLoading(true);
      createNativeNeonParsedTokenAccount(provider, signerAddress).then(
        (result) => {
          console.log("create native account returned with value", result);
          if (!cancelled) {
            setEthNativeAccount(result);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("");
          }
        },
        (error) => {
          if (!cancelled) {
            setEthNativeAccount(undefined);
            setEthNativeAccountLoading(false);
            setEthNativeAccountError("Unable to retrieve your Neon balance.");
          }
        }
      );
    }

    return () => {
      cancelled = true;
    };
  }, [lookupChain, provider, signerAddress, nft, ethNativeAccount]);

  //Ethereum covalent or blockscout accounts load
  useEffect(() => {
    //const testWallet = "0xf60c2ea62edbfe808163751dd0d8693dcb30019c";
    // const nftTestWallet1 = "0x3f304c6721f35ff9af00fd32650c8e0a982180ab";
    // const nftTestWallet2 = "0x98ed231428088eb440e8edb5cc8d66dcf913b86e";
    // const nftTestWallet3 = "0xb1fadf677a7e9b90e9d4f31c8ffb3dc18c138c6f";
    // const nftBscTestWallet1 = "0x5f464a652bd1991df0be37979b93b3306d64a909";

    let cancelled = false;
    const walletAddress = signerAddress;
    if (walletAddress && isEVMChain(lookupChain) && signer !== undefined) {
      if (covalent) {
        dispatch(receiveSourceParsedTokenAccounts(
          covalent.map((x) =>
            createParsedTokenAccountFromCovalent(walletAddress, x)
          )
        ))
        return
      }

      //TODO less cancel
      !cancelled && setCovalentLoading(true);
      !cancelled && dispatch(fetchSourceParsedTokenAccounts());
      getEVMAccounts(lookupChain, targetChain, signer, walletAddress).then(
        (accounts) => {
          !cancelled && setCovalentLoading(false);
          !cancelled && setCovalentError(undefined);
          !cancelled && setCovalent(accounts);
          !cancelled &&
            dispatch(receiveSourceParsedTokenAccounts(
              accounts.map((x) =>
                createParsedTokenAccountFromCovalent(walletAddress, x)
              )
            ))
        },
        () => {
          !cancelled &&
            dispatch(
              nft
                ? errorSourceParsedTokenAccountsNFT(
                    t("Cannot load your Ethereum NFTs at the moment.")
                  )
                : errorSourceParsedTokenAccounts(
                    t("Cannot load your Ethereum tokens at the moment.")
                  )
            );
          !cancelled &&
            setCovalentError(t("Cannot load your Ethereum tokens at the moment."));
          !cancelled && setCovalentLoading(false);
        }
      );

      return () => {
        cancelled = true;
      };
    }
  }, [lookupChain, targetChain, provider, signerAddress, dispatch, nft, covalent, signer, t]);

  useEffect(() => {
    if (
      lookupChain === CHAIN_ID_ALEPHIUM &&
      currentSourceWalletAddress !== undefined &&
      alphTokens === undefined &&
      alphWallet?.nodeProvider !== undefined &&
      !alphTokenLoading
    ) {
      setAlphTokenLoading(true)
      dispatch(fetchSourceParsedTokenAccounts())
      getAlephiumParsedTokenAccounts(targetChain, currentSourceWalletAddress, alphWallet.nodeProvider)
        .then((result) => {
          setAlphTokens(result.tokenAccounts)
          setAlphBalances(result.balances)
          setAlphTokenLoading(false)
          setAlphTokenError(undefined)
        })
        .catch((error) => {
          enqueueSnackbar(null, {
            content: <Alert severity="error">{parseError(error)}</Alert>,
          })
          console.log(`failed to load tokens from alephium, error: ${error}`)
          setAlphTokens([])
          setAlphTokenLoading(false)
          setAlphTokenError(`${error}`)
        })
    }
  }, [dispatch, enqueueSnackbar, lookupChain, targetChain, currentSourceWalletAddress, alphWallet?.nodeProvider, alphTokens, alphTokenLoading]);

  //Terra accounts load
  //At present, we don't have any mechanism for doing this.
  useEffect(() => {}, []);
  //Algorand accounts load
  useEffect(() => {
    if (lookupChain === CHAIN_ID_ALGORAND && currentSourceWalletAddress) {
      if (
        !(tokenAccounts.data || tokenAccounts.isFetching || tokenAccounts.error)
      ) {
        getAlgorandParsedTokenAccounts(
          currentSourceWalletAddress,
          dispatch,
          nft
        );
      }
    }

    return () => {};
  }, [dispatch, lookupChain, currentSourceWalletAddress, tokenAccounts, nft]);

  const ethAccounts = useMemo(() => {
    const output = { ...tokenAccounts };
    output.data = output.data?.slice() || [];
    output.isFetching = output.isFetching || ethNativeAccountLoading;
    output.error = output.error || ethNativeAccountError;
    ethNativeAccount && output.data && output.data.unshift(ethNativeAccount);
    return output;
  }, [
    ethNativeAccount,
    ethNativeAccountLoading,
    ethNativeAccountError,
    tokenAccounts,
  ]);

  return lookupChain === CHAIN_ID_SOLANA
    ? {
        tokenAccounts,
        mintAccounts: {
          data: solanaMintAccounts,
          isFetching: solanaMintAccountsLoading,
          error: solanaMintAccountsError,
          receivedAt: null, //TODO
        },
        resetAccounts: resetSourceAccounts,
      }
    : isEVMChain(lookupChain)
    ? {
        tokenAccounts: ethAccounts,
        covalent: {
          data: covalent,
          isFetching: covalentLoading,
          error: covalentError,
          receivedAt: null, //TODO
        },
        resetAccounts: resetSourceAccounts,
      }
    : lookupChain === CHAIN_ID_TERRA
    ? {
        resetAccounts: resetSourceAccounts,
      }
    : lookupChain === CHAIN_ID_ALEPHIUM
    ? {
        tokens: alphTokens,
        balances: alphBalances,
        isFetching: alphTokenLoading,
        error: alphTokenError,
        resetAccounts: resetSourceAccounts,
      }
    : lookupChain === CHAIN_ID_ALGORAND
    ? {
        tokenAccounts,
        resetAccounts: resetSourceAccounts,
      }
    : undefined;
}

export default useGetAvailableTokens;

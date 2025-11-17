import bscIcon from '../../../bridge-assets/icons/bsc.svg';
import ethIcon from '../../../bridge-assets/icons/eth.svg';
import alephiumIcon from '../../../bridge-assets/icons/alephium.svg';
import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_BSC,
  CHAIN_ID_ETH,
  ChainId,
  getTokenPoolId,
  tryNativeToHexString,
} from '@alephium/wormhole-sdk';
import { getConst } from './consts';
import i18n from '../i18n';
import { getAlephiumTokenLogoAndSymbol } from './alephium';
import { getBSCTokenLogoAndSymbol, getETHTokenLogoAndSymbol } from './evm';

export type RegisteredTokenInfo = {
  tokenAddress: string;
  tokenChain: ChainId;
  decimals: number;
  symbol: string;
  name: string;
  nativeAddress: string;
  logo?: string;
};

let _registeredTokens: RegisteredTokenInfo[] | undefined = undefined;

export async function getRegisteredTokens(): Promise<RegisteredTokenInfo[]> {
  try {
    if (_registeredTokens !== undefined) return _registeredTokens;

    const response = await fetch(
      `${getConst('EXPLORER_API_SERVER_HOST')}/api/stats/tokens`,
    );
    if (!response.ok) {
      throw new Error(
        `${i18n.t('Failed to get tokens')}, ${i18n.t('response status')}: ${
          response.status
        }`,
      );
    }
    const tokenList = await response.json();
    if (!Array.isArray(tokenList)) {
      throw new Error(i18n.t('Invalid response, expect a token list'));
    }
    const tokens = (tokenList as any[]).map((item) => {
      const symbol = (item['symbol'] as string).toUpperCase();
      return {
        tokenAddress: item['tokenAddress'],
        tokenChain: item['tokenChain'],
        decimals: item['decimals'],
        symbol: symbol,
        name: item['name'],
        nativeAddress: item['nativeAddress'],
        logo:
          symbol === 'ALPH'
            ? alephiumIcon
            : symbol === 'WETH'
            ? ethIcon
            : symbol === 'WBNB'
            ? bscIcon
            : undefined,
      };
    });
    _registeredTokens = tokens;
    return tokens;
  } catch (error) {
    console.log(error);
    return [];
  }
}

export async function getTokenLogoAndSymbol(
  tokenChainId: ChainId,
  tokenId: string,
): Promise<{ logoURI?: string; symbol?: string } | undefined> {
  if (tokenChainId !== CHAIN_ID_ALEPHIUM) {
    const wrappedIdOnALPH = getTokenPoolId(
      getConst('ALEPHIUM_TOKEN_BRIDGE_CONTRACT_ID'),
      tokenChainId,
      tryNativeToHexString(tokenId, tokenChainId),
      getConst('ALEPHIUM_BRIDGE_GROUP_INDEX'),
    );
    const info = await getAlephiumTokenLogoAndSymbol(wrappedIdOnALPH);
    if (info !== undefined) return info;
  }

  if (tokenChainId === CHAIN_ID_ETH) {
    return getETHTokenLogoAndSymbol(tokenId);
  } else if (tokenChainId === CHAIN_ID_ALEPHIUM) {
    return getAlephiumTokenLogoAndSymbol(tokenId);
  } else if (tokenChainId === CHAIN_ID_BSC) {
    return getBSCTokenLogoAndSymbol(tokenId);
  } else {
    return undefined;
  }
}

import {
  ethers_contracts,
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_TERRA,
  getForeignAssetTerra,
  hexToUint8Array,
  isEVMChain,
  getTokenPoolId,
  tryNativeToHexString,
  coalesceChainName,
  contractExists,
  getRemoteTokenInfo
} from "alephium-wormhole-sdk";
import { LCDClient } from "@terra-money/terra.js";
import { ethers } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import {
  AlephiumChainConfigInfo,
  EthereumChainConfigInfo,
  getWalletMonitorEnvironment,
  SupportedToken,
  TerraChainConfigInfo,
  WalletMonitorEnvironment
} from "../configureEnv";
import { getScopedLogger } from "../helpers/logHelper";
import { PromHelper } from "../helpers/promHelpers";
import { getEthereumToken } from "../utils/ethereum";
import { formatNativeDenom } from "../utils/terra";
import { newProvider } from "../relayer/evm";
import {
  addressFromContractId,
  ALPH_TOKEN_ID,
  NodeProvider,
  web3
} from "@alephium/web3"
import { sleep } from "../helpers/utils";

let env: WalletMonitorEnvironment;
const logger = getScopedLogger(["walletMonitor"]);

export type WalletBalance = {
  chainId: ChainId;
  balanceAbs: string;
  balanceFormatted?: string;
  currencyName: string;
  currencyAddressNative: string;
  isNative: boolean;
  walletAddress: string;
};

export interface TerraNativeBalances {
  [index: string]: string;
}

function init() {
  try {
    env = getWalletMonitorEnvironment();
  } catch (e) {
    logger.error("Unable to instantiate the relayerEnv in wallet monitor");
  }
}

async function pullBalances(metrics: PromHelper): Promise<WalletBalance[]> {
  //TODO loop through all the chain configs, calc the public keys, pull their balances, and push to a combo of the loggers and prmometheus
  if (!env.supportedChains) {
    logger.info(`Skip pull balances because there is no 'supportedChains' in configs`);
    return [];
  }
  const balancePromises: Promise<WalletBalance[]>[] = [];
  for (const chainInfo of env.supportedChains) {
    if (!chainInfo) continue;
    try {
      if (isEVMChain(chainInfo.chainId)) {
        const ethChainInfo = chainInfo as EthereumChainConfigInfo
        for (const walletAddress of ethChainInfo.walletAddresses as string[] || []) {
          try {
            balancePromises.push(pullEVMNativeBalance(ethChainInfo, walletAddress));
          } catch (e) {
            logger.error(`Pulling evm native balance failed, err: ${e}`);
          }
        }
        // TODO one day this will spin up independent watchers that time themselves
        // purposefully not awaited
        pullAllEVMTokens(env.supportedTokens, ethChainInfo, metrics);
      } else if (chainInfo.chainId === CHAIN_ID_TERRA) {
        // TODO one day this will spin up independent watchers that time themselves
        // purposefully not awaited
        pullAllTerraBalances(env.supportedTokens, chainInfo as TerraChainConfigInfo, metrics);
      } else if (chainInfo.chainId === CHAIN_ID_ALEPHIUM) {
        pullAllAlephiumBalances(env.supportedTokens, chainInfo as AlephiumChainConfigInfo, metrics)
      } else {
        logger.error(`Invalid chain ID in wallet monitor: ${chainInfo.chainId}`);
      }
    } catch (e: any) {
      logger.error(`Pulling balances failed failed for chain: ${coalesceChainName(chainInfo.chainId)}, err: ${e}`);
      if (e.stack) {
        logger.error(e.stack);
      }
    }
  }

  const balancesArrays = await Promise.all(balancePromises);
  const balances = balancesArrays.reduce(
    (prev, curr) => [...prev, ...curr],
    []
  );

  return balances;
}

export async function pullTerraBalance(
  lcd: LCDClient,
  walletAddress: string,
  tokenAddress: string
): Promise<WalletBalance | undefined> {
  try {
    const tokenInfo: any = await lcd.wasm.contractQuery(tokenAddress, {
      token_info: {},
    });
    const balanceInfo: any = await lcd.wasm.contractQuery(tokenAddress, {
      balance: {
        address: walletAddress,
      },
    });

    if (!tokenInfo || !balanceInfo) {
      return undefined;
    }

    return {
      chainId: CHAIN_ID_TERRA,
      balanceAbs: balanceInfo?.balance?.toString() || "0",
      balanceFormatted: formatUnits(
        balanceInfo?.balance?.toString() || "0",
        tokenInfo.decimals
      ),
      currencyName: tokenInfo.symbol,
      currencyAddressNative: tokenAddress,
      isNative: false,
      walletAddress: walletAddress,
    };
  } catch (e) {
    logger.error(`Failed to fetch terra balance for ${tokenAddress}, err: ${e}`);
  }
}

async function pullEVMNativeBalance(
  chainInfo: EthereumChainConfigInfo,
  address: string
): Promise<WalletBalance[]> {
  if (!address || !chainInfo.nodeUrl) {
    throw new Error("Bad chainInfo config for EVM chain: " + chainInfo.chainId);
  }

  let provider = newProvider(chainInfo.nodeUrl);
  if (!provider) throw new Error("bad provider");
  const weiAmount = await provider.getBalance(address);
  const balanceInEth = ethers.utils.formatEther(weiAmount);

  return [
    {
      chainId: chainInfo.chainId,
      balanceAbs: weiAmount.toString(),
      balanceFormatted: balanceInEth.toString(),
      currencyName: chainInfo.nativeCurrencySymbol,
      currencyAddressNative: "",
      isNative: true,
      walletAddress: address,
    },
  ];
}

async function pullTerraNativeBalance(
  lcd: LCDClient,
  chainInfo: TerraChainConfigInfo,
  walletAddress: string
): Promise<WalletBalance[]> {
  try {
    const output: WalletBalance[] = [];
    const [coins] = await lcd.bank.balance(walletAddress);
    // coins doesn't support reduce
    const balancePairs = coins.map(({ amount, denom }) => [denom, amount]);
    const balance = balancePairs.reduce((obj, current) => {
      obj[current[0].toString()] = current[1].toString();
      return obj;
    }, {} as TerraNativeBalances);
    Object.keys(balance).forEach((key) => {
      output.push({
        chainId: chainInfo.chainId,
        balanceAbs: balance[key],
        balanceFormatted: formatUnits(balance[key], 6).toString(),
        currencyName: formatNativeDenom(key),
        currencyAddressNative: key,
        isNative: true,
        walletAddress: walletAddress,
      });
    });
    return output;
  } catch (e) {
    logger.error(`Failed to fetch terra native balances for wallet ${walletAddress}, err: ${e}`);
    return [];
  }
}

export async function collectWallets(metrics: PromHelper) {
  const scopedLogger = getScopedLogger(["collectWallets"], logger);
  const ONE_MINUTE: number = 60000;
  scopedLogger.info("Starting up.");
  init();
  while (true) {
    scopedLogger.debug("Pulling balances.");
    let wallets: WalletBalance[] = [];
    try {
      wallets = await pullBalances(metrics);
    } catch (e) {
      scopedLogger.error(`Failed to pullBalances, err: ${e}`);
    }
    scopedLogger.debug("Done pulling balances.");
    metrics.handleWalletBalances(wallets);
    await sleep(ONE_MINUTE);
  }
}

async function calcLocalAddressesEVM(
  provider: ethers.providers.JsonRpcBatchProvider,
  supportedTokens: SupportedToken[],
  chainConfigInfo: EthereumChainConfigInfo
): Promise<string[]> {
  const tokenBridge = ethers_contracts.Bridge__factory.connect(
    chainConfigInfo.tokenBridgeAddress,
    provider
  );
  let tokenAddressPromises: Promise<string>[] = [];
  for (const supportedToken of supportedTokens) {
    if (supportedToken.chainId === chainConfigInfo.chainId) {
      tokenAddressPromises.push(Promise.resolve(supportedToken.address));
      continue;
    }
    const hexAddress = tryNativeToHexString(supportedToken.address, supportedToken.chainId)
    if (!hexAddress) {
      logger.debug(
        "calcLocalAddressesEVM() - no hexAddress for chainId: " +
          supportedToken.chainId +
          ", address: " +
          supportedToken.address
      );
      continue;
    }
    tokenAddressPromises.push(
      tokenBridge.wrappedAsset(
        supportedToken.chainId,
        hexToUint8Array(hexAddress)
      )
    );
  }
  return (await Promise.all(tokenAddressPromises)).filter(
    (tokenAddress) =>
      tokenAddress && tokenAddress !== ethers.constants.AddressZero
  );
}

export async function calcLocalAddressesTerra(
  lcd: LCDClient,
  supportedTokens: SupportedToken[],
  chainConfigInfo: TerraChainConfigInfo
) {
  const output: string[] = [];
  for (const supportedToken of supportedTokens) {
    if (supportedToken.chainId === chainConfigInfo.chainId) {
      // skip natives, like uluna and uusd
      if (supportedToken.address.startsWith("terra")) {
        output.push(supportedToken.address);
      }
      continue;
    }
    const hexAddress = tryNativeToHexString(
      supportedToken.address,
      supportedToken.chainId
    );
    if (!hexAddress) {
      continue;
    }
    //This returns a native address
    let foreignAddress;
    try {
      foreignAddress = await getForeignAssetTerra(
        chainConfigInfo.tokenBridgeAddress,
        lcd,
        supportedToken.chainId,
        hexToUint8Array(hexAddress)
      );
    } catch (e) {
      logger.error("Foreign address exception.");
    }

    if (!foreignAddress) {
      continue;
    }
    output.push(foreignAddress);
  }

  return output;
}

async function pullAllEVMTokens(
  supportedTokens: SupportedToken[],
  chainConfig: EthereumChainConfigInfo,
  metrics: PromHelper
) {
  try {
    let provider = newProvider(
      chainConfig.nodeUrl,
      true
    ) as ethers.providers.JsonRpcBatchProvider;
    const localAddresses = await calcLocalAddressesEVM(
      provider,
      supportedTokens,
      chainConfig
    );
    for (const walletAddress of chainConfig.walletAddresses as string[] || []) {
      try {
        const tokens = await Promise.all(
          localAddresses.map((tokenAddress) =>
            getEthereumToken(tokenAddress, provider)
          )
        );
        const tokenInfos = await Promise.all(
          tokens.map((token) =>
            Promise.all([
              token.decimals(),
              token.balanceOf(walletAddress),
              token.symbol(),
            ])
          )
        );
        const balances = tokenInfos.map(([decimals, balance, symbol], idx) => ({
          chainId: chainConfig.chainId,
          balanceAbs: balance.toString(),
          balanceFormatted: formatUnits(balance, decimals),
          currencyName: symbol,
          currencyAddressNative: localAddresses[idx],
          isNative: false,
          walletAddress: walletAddress,
        }));
        logger.debug(`Ethereum wallet balances: ${JSON.stringify(balances)}`)
        metrics.handleWalletBalances(balances);
      } catch (e) {
        logger.error(
          "Failed to pull evm tokens: for tokens " +
            JSON.stringify(localAddresses) +
            " on chain " +
            chainConfig.chainId +
            ", error: " +
            e
        );
      }
    }
  } catch (e) {
    logger.error(`Failed to pull evm tokens for chain: ${chainConfig.chainName}, err: ${e}`);
  }
}

async function pullAllTerraBalances(
  supportedTokens: SupportedToken[],
  chainConfig: TerraChainConfigInfo,
  metrics: PromHelper
) {
  let balances: WalletBalance[] = [];
  const lcdConfig = {
    URL: chainConfig.nodeUrl,
    chainID: chainConfig.terraChainId,
    name: chainConfig.terraName,
  };
  const lcd = new LCDClient(lcdConfig);
  const localAddresses = await calcLocalAddressesTerra(
    lcd,
    supportedTokens,
    chainConfig
  );
  for (const walletAddress of chainConfig.walletAddresses as string[] || []) {
    balances = [
      ...balances,
      ...(await pullTerraNativeBalance(lcd, chainConfig, walletAddress)),
    ];
    for (const address of localAddresses) {
      const balance = await pullTerraBalance(lcd, walletAddress, address);
      if (balance) {
        balances.push(balance);
      }
    }
  }

  metrics.handleWalletBalances(balances);
}

async function pullAllAlephiumBalances(
  supportedTokens: SupportedToken[],
  chainConfig: AlephiumChainConfigInfo,
  metrics: PromHelper
) {
  const nodeProvider = new NodeProvider(chainConfig.nodeUrl)
  web3.setCurrentNodeProvider(nodeProvider)
  const walletBalances: WalletBalance[] = []
  try {
    for (const walletAddress of chainConfig.walletAddresses as string[] || []) {
      const balances = await nodeProvider.addresses.getAddressesAddressBalance(walletAddress)
      walletBalances.push({
        chainId: chainConfig.chainId,
        balanceAbs: balances.balance,
        balanceFormatted: balances.balanceHint.slice(0, -5),
        currencyName: 'ALPH',
        currencyAddressNative: '',
        isNative: true,
        walletAddress: walletAddress
      })

      for (const token of supportedTokens) {
        const originTokenId = tryNativeToHexString(token.address, token.chainId)
        if (originTokenId === ALPH_TOKEN_ID) {
          continue
        }
        if (token.chainId === CHAIN_ID_ALEPHIUM) {
          const tokenBalance = balances.tokenBalances?.find(t => t.id === originTokenId)
          const amount = tokenBalance?.amount ?? '0'
          walletBalances.push({
            chainId: chainConfig.chainId,
            balanceAbs: amount,
            balanceFormatted: amount,
            currencyName: '', // TODO: get token name from config
            currencyAddressNative: token.address,
            isNative: false,
            walletAddress: walletAddress
          })
          continue
        }

        const tokenPoolId = getTokenPoolId(chainConfig.tokenBridgeAddress, token.chainId, originTokenId, chainConfig.groupIndex)
        const tokenExists = await contractExists(tokenPoolId, nodeProvider)
        if (!tokenExists) {
          continue
        }
        const tokenBalance = balances.tokenBalances?.find(t => t.id === tokenPoolId)
        const amount = tokenBalance?.amount ?? '0'
        const contractAddress = addressFromContractId(tokenPoolId)
        const tokenInfo = await getRemoteTokenInfo(contractAddress)
        walletBalances.push({
          chainId: chainConfig.chainId,
          balanceAbs: amount,
          balanceFormatted: formatUnits(amount, tokenInfo.decimals),
          currencyName: tokenInfo.name,
          currencyAddressNative: contractAddress,
          isNative: false,
          walletAddress: walletAddress
        })
      }
    }
    logger.debug(`Alephium wallet balances: ${JSON.stringify(walletBalances)}`)
    metrics.handleWalletBalances(walletBalances)
  } catch (error) {
    logger.error(`Failed to pull Alephium wallet balances, error: ${error}`)
  }
}

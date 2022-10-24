import {
  Bridge__factory,
  ChainId,
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  getForeignAssetTerra,
  hexToUint8Array,
  isEVMChain,
  nativeToHexString,
  WSOL_DECIMALS,
  getTokenPoolId
} from "alephium-wormhole-sdk";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair } from "@solana/web3.js";
import { LCDClient, MnemonicKey } from "@terra-money/terra.js";
import { ethers, Signer } from "ethers";
import { formatUnits } from "ethers/lib/utils";
import {
  AlephiumChainConfigInfo,
  EthereumChainConfigInfo,
  getRelayerEnvironment,
  RelayerEnvironment,
  SolanaChainConfigInfo,
  SupportedToken,
  TerraChainConfigInfo
} from "../configureEnv";
import { getScopedLogger } from "../helpers/logHelper";
import { PromHelper } from "../helpers/promHelpers";
import { getMetaplexData, sleep } from "../helpers/utils";
import { getEthereumToken } from "../utils/ethereum";
import { getMultipleAccountsRPC } from "../utils/solana";
import { formatNativeDenom } from "../utils/terra";
import { newProvider } from "../relayer/evm";
import { addressFromContractId, NodeProvider, web3 } from "@alephium/web3"
import { PrivateKeyWallet } from "@alephium/web3-wallet";
import { ValByteVec, ValU256 } from "@alephium/web3/dist/src/api/api-alephium";

let env: RelayerEnvironment;
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
    env = getRelayerEnvironment();
  } catch (e) {
    logger.error("Unable to instantiate the relayerEnv in wallet monitor");
  }
}

async function pullBalances(metrics: PromHelper): Promise<WalletBalance[]> {
  //TODO loop through all the chain configs, calc the public keys, pull their balances, and push to a combo of the loggers and prmometheus
  if (!env) {
    logger.error("pullBalances() - no env");
    return [];
  }
  if (!env.supportedChains) {
    logger.error("pullBalances() - no supportedChains");
    return [];
  }
  const balancePromises: Promise<WalletBalance[]>[] = [];
  for (const chainInfo of env.supportedChains) {
    if (!chainInfo) continue;
    try {
      if (chainInfo.chainId === CHAIN_ID_SOLANA) {
        const solanaChainConfig = chainInfo as SolanaChainConfigInfo
        for (const solanaPrivateKey of solanaChainConfig.walletPrivateKeys as Uint8Array[] || []) {
          try {
            balancePromises.push(
              pullSolanaNativeBalance(solanaChainConfig, solanaPrivateKey)
            );
            balancePromises.push(
              pullSolanaTokenBalances(solanaChainConfig, solanaPrivateKey)
            );
          } catch (e: any) {
            logger.error(
              "pulling balances failed failed for chain: " + solanaChainConfig.chainName
            );
            if (e && e.stack) {
              logger.error(e.stack);
            }
          }
        }
      } else if (isEVMChain(chainInfo.chainId)) {
        const ethChainInfo = chainInfo as EthereumChainConfigInfo
        for (const privateKey of ethChainInfo.walletPrivateKeys as string[] || []) {
          try {
            balancePromises.push(pullEVMNativeBalance(ethChainInfo, privateKey));
          } catch (e) {
            logger.error("pullEVMNativeBalance() failed: " + e);
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
        logger.error("Invalid chain ID in wallet monitor " + chainInfo.chainId);
      }
    } catch (e: any) {
      logger.error(
        "pulling balances failed failed for chain: " + chainInfo.chainName
      );
      if (e && e.stack) {
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
    logger.error("Failed to fetch terra balance for %s", tokenAddress);
  }
}

async function pullSolanaTokenBalances(
  chainInfo: SolanaChainConfigInfo,
  privateKey: Uint8Array
): Promise<WalletBalance[]> {
  const keyPair = Keypair.fromSecretKey(privateKey);
  const connection = new Connection(chainInfo.nodeUrl);
  const output: WalletBalance[] = [];

  try {
    const allAccounts = await connection.getParsedTokenAccountsByOwner(
      keyPair.publicKey,
      { programId: TOKEN_PROGRAM_ID },
      "confirmed"
    );
    let mintAddresses: string[] = [];
    allAccounts.value.forEach((account) => {
      mintAddresses.push(account.account.data.parsed?.info?.mint);
    });
    const mdArray = await getMetaplexData(mintAddresses, chainInfo);

    for (const account of allAccounts.value) {
      let mintAddress: string[] = [];
      mintAddress.push(account.account.data.parsed?.info?.mint);
      const mdArray = await getMetaplexData(mintAddress, chainInfo);
      let cName: string = "";
      if (mdArray && mdArray[0] && mdArray[0].data && mdArray[0].data.symbol) {
        const encoded = mdArray[0].data.symbol;
        cName = encodeURIComponent(encoded);
        cName = cName.replace(/%/g, "_");
      }

      output.push({
        chainId: CHAIN_ID_SOLANA,
        balanceAbs: account.account.data.parsed?.info?.tokenAmount?.amount,
        balanceFormatted:
          account.account.data.parsed?.info?.tokenAmount?.uiAmount,
        currencyName: cName,
        currencyAddressNative: account.account.data.parsed?.info?.mint,
        isNative: false,
        walletAddress: account.pubkey.toString(),
      });
    }
  } catch (e) {
    logger.error("pullSolanaTokenBalances() - ", e);
  }

  return output;
}

async function pullEVMNativeBalance(
  chainInfo: EthereumChainConfigInfo,
  privateKey: string
): Promise<WalletBalance[]> {
  if (!privateKey || !chainInfo.nodeUrl) {
    throw new Error("Bad chainInfo config for EVM chain: " + chainInfo.chainId);
  }

  let provider = newProvider(chainInfo.nodeUrl);
  if (!provider) throw new Error("bad provider");
  const signer: Signer = new ethers.Wallet(privateKey, provider);
  const addr: string = await signer.getAddress();
  const weiAmount = await provider.getBalance(addr);
  const balanceInEth = ethers.utils.formatEther(weiAmount);

  return [
    {
      chainId: chainInfo.chainId,
      balanceAbs: weiAmount.toString(),
      balanceFormatted: balanceInEth.toString(),
      currencyName: chainInfo.nativeCurrencySymbol,
      currencyAddressNative: "",
      isNative: true,
      walletAddress: addr,
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
    logger.error(
      "Failed to fetch terra native balances for wallet %s",
      walletAddress
    );
    return [];
  }
}

async function pullSolanaNativeBalance(
  chainInfo: SolanaChainConfigInfo,
  privateKey: Uint8Array
): Promise<WalletBalance[]> {
  const keyPair = Keypair.fromSecretKey(privateKey);
  const connection = new Connection(chainInfo.nodeUrl);
  const fetchAccounts = await getMultipleAccountsRPC(connection, [
    keyPair.publicKey,
  ]);

  if (!fetchAccounts[0]) {
    //Accounts with zero balance report as not existing.
    return [
      {
        chainId: chainInfo.chainId,
        balanceAbs: "0",
        balanceFormatted: "0",
        currencyName: chainInfo.nativeCurrencySymbol,
        currencyAddressNative: chainInfo.chainName,
        isNative: true,
        walletAddress: keyPair.publicKey.toString(),
      },
    ];
  }

  const amountLamports = fetchAccounts[0].lamports.toString();
  const amountSol = formatUnits(
    fetchAccounts[0].lamports,
    WSOL_DECIMALS
  ).toString();

  return [
    {
      chainId: chainInfo.chainId,
      balanceAbs: amountLamports,
      balanceFormatted: amountSol,
      currencyName: chainInfo.nativeCurrencySymbol,
      currencyAddressNative: "",
      isNative: true,
      walletAddress: keyPair.publicKey.toString(),
    },
  ];
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
      scopedLogger.error("Failed to pullBalances: " + e);
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
  const tokenBridge = Bridge__factory.connect(
    chainConfigInfo.tokenBridgeAddress,
    provider
  );
  let tokenAddressPromises: Promise<string>[] = [];
  for (const supportedToken of supportedTokens) {
    if (supportedToken.chainId === chainConfigInfo.chainId) {
      tokenAddressPromises.push(Promise.resolve(supportedToken.address));
      continue;
    }
    const hexAddress = supportedToken.chainId === CHAIN_ID_ALEPHIUM
      ? supportedToken.address
      : nativeToHexString(supportedToken.address, supportedToken.chainId)
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
    const hexAddress = nativeToHexString(
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
    if (!chainConfig.walletPrivateKeys) {
      return;
    }
    for (const privateKey of chainConfig.walletPrivateKeys) {
      try {
        const publicAddress = await new ethers.Wallet(privateKey).getAddress();
        const tokens = await Promise.all(
          localAddresses.map((tokenAddress) =>
            getEthereumToken(tokenAddress, provider)
          )
        );
        const tokenInfos = await Promise.all(
          tokens.map((token) =>
            Promise.all([
              token.decimals(),
              token.balanceOf(publicAddress),
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
          walletAddress: publicAddress,
        }));
        metrics.handleWalletBalances(balances);
      } catch (e) {
        logger.error(
          "pullAllEVMTokens failed: for tokens " +
            JSON.stringify(localAddresses) +
            " on chain " +
            chainConfig.chainId +
            ", error: " +
            e
        );
      }
    }
  } catch (e) {
    logger.error(
      "pullAllEVMTokens failed: for chain " +
        chainConfig.chainId +
        ", error: " +
        e
    );
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
  for (const privateKey of chainConfig.walletPrivateKeys as string[]) {
    const mk = new MnemonicKey({
      mnemonic: privateKey,
    });
    const wallet = lcd.wallet(mk);
    const walletAddress = wallet.key.accAddress;
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
  const groupIndex = chainConfig.groupIndex!
  const nodeProvider = new NodeProvider(chainConfig.nodeUrl)
  web3.setCurrentNodeProvider(nodeProvider)
  const walletBalances: WalletBalance[] = []
  for (const mnemonic of chainConfig.walletPrivateKeys as string[]) {
    const wallet = PrivateKeyWallet.FromMnemonicWithGroup(mnemonic, groupIndex)
    const account = await wallet.getSelectedAccount()
    const balances = await nodeProvider.addresses.getAddressesAddressBalance(account.address)
    walletBalances.push({
      chainId: chainConfig.chainId,
      balanceAbs: balances.balance,
      balanceFormatted: balances.balanceHint.slice(0, -5),
      currencyName: 'ALPH',
      currencyAddressNative: '',
      isNative: true,
      walletAddress: account.address
    })

    for (const token of supportedTokens) {
      if (token.chainId === CHAIN_ID_ALEPHIUM) {
        const tokenBalance = balances.tokenBalances?.find(t => t.id === token.address)
        const amount = tokenBalance?.amount ?? '0'
        walletBalances.push({
          chainId: chainConfig.chainId,
          balanceAbs: amount,
          balanceFormatted: amount,
          currencyName: '', // TODO: get token name from config
          currencyAddressNative: addressFromContractId(token.address),
          isNative: false,
          walletAddress: account.address
        })
      } else {
        const hasPrefix = token.address.startsWith('0x') || token.address.startsWith('0X')
        const originTokenId = hasPrefix ? token.address.slice(2) : token.address
        const tokenId = getTokenPoolId(chainConfig.tokenBridgeAddress, token.chainId, originTokenId)
        const tokenBalance = balances.tokenBalances?.find(t => t.id === tokenId)
        const amount = tokenBalance?.amount ?? '0'
        const contractAddress = addressFromContractId(tokenId)
        // TODO: move this to SDK
        const contractState = await nodeProvider.contracts.getContractsAddressState(contractAddress, {group: groupIndex})
        const name = (contractState.fields[5] as ValByteVec).value
        const decimals = parseInt((contractState.fields[6] as ValU256).value)
        walletBalances.push({
          chainId: chainConfig.chainId,
          balanceAbs: amount,
          balanceFormatted: formatUnits(amount, decimals),
          currencyName: name,
          currencyAddressNative: contractAddress,
          isNative: false,
          walletAddress: account.address
        })
      }
    }
  }
  metrics.handleWalletBalances(walletBalances)
}

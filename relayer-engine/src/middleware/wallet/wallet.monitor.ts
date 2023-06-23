import { EventEmitter } from 'stream';
import { Logger } from "winston";
import { ChainId, isEVMChain, CHAIN_ID_ALEPHIUM, coalesceChainName, CHAIN_ID_ETH, CHAIN_ID_BSC, ethers_contracts } from "@alephium/wormhole-sdk";
import {
  ChainWalletMonitorConfig,
  TokenBalance,
  WalletBalancesByAddress,
  WalletChainConfig,
  WalletMonitorConfig,
  WalletMonitorMetricsOption
} from "./types";
import { ALPH_TOKEN_ID, NetworkId, NodeProvider, prettifyAttoAlphAmount, prettifyTokenAmount, web3 } from "@alephium/web3";
import { PrometheusExporter } from './prometheus-export';
import { ethers } from 'ethers';
import { getNodeUrl, newEVMProvider } from '../../utils';
import { formatUnits } from 'ethers/lib/utils';

export type Addresses = Partial<{ [k in ChainId]: string[] }>;
export type TokensByChain = Partial<{ [k in ChainId]: string[] }>;

function buildWalletsConfig(
  networkId: NetworkId,
  addresses: Addresses,
  tokensByChain?: TokensByChain,
): WalletMonitorConfig {
  const config: WalletMonitorConfig = {
    network: networkId,
    chains: []
  };
  const tokens = tokensByChain ?? {};
  for (const [chainIdStr, addrs] of Object.entries(addresses)) {
    const chainId = Number(chainIdStr) as ChainId;
    const chainWallets = [];
    if (isEVMChain(chainId)) {
      for (const addr of addrs) {
        chainWallets.push({
          address: addr,
          tokens: tokens[chainId] ?? [],
        });
      }
    } else if (CHAIN_ID_ALEPHIUM === chainId) {
      for (const addr of addrs) {
        chainWallets.push({
          address: addr,
          tokens: tokens[chainId] ?? [],
        });
      }
    }

    config.chains.push({
      walletChainConfig: { chainId, wallets: chainWallets },
      nodeUrl: getNodeUrl(networkId, chainId),
      balancePollInterval: (isEVMChain(chainId) ? 3 : 10) * 1000
    });
  }
  return config;
}

export function startWalletMonitor(
  networkId: NetworkId,
  addresses: Addresses,
  logger: Logger,
  tokensByChain?: TokensByChain,
  metricsOption?: WalletMonitorMetricsOption,
) {
  const config = buildWalletsConfig(networkId, addresses, tokensByChain);
  return new WalletMonitor({ ...config, metricsOption }, logger.child({ module: 'wallet-monitor' }));
}

class WalletMonitor {
  private emitter: EventEmitter = new EventEmitter();
  private monitors: Record<number, ChainWalletMonitor> = {};
  private exporter?: PrometheusExporter;
  protected logger: Logger;

  constructor(config: WalletMonitorConfig, logger: Logger) {
    this.logger = logger
    if (config.metricsOption?.enabled) {
      const { port, path, registry } = config.metricsOption;
      this.exporter = new PrometheusExporter(port, path, registry);
      if (config.metricsOption?.serve) {
        this.logger.info('Starting metrics server.');
        this.exporter.startMetricsServer();
      }
    }

    const network = config.network
    for (const chain of config.chains) {
      const chainId = chain.walletChainConfig.chainId
      const chainName = coalesceChainName(chainId)
      const chainMonitor = ChainWalletMonitor.create(chain, logger);

      chainMonitor.on('error', (error: any) => {
        this.logger.error('Error in chain manager: ${error}');
        this.emitter.emit('error', error, chainName);
      });

      chainMonitor.on('balances', (balances: WalletBalancesByAddress) => {
        this.logger.verbose(`Balances updated for ${chainName} (${network})`);
        this.exporter?.updateBalances(chainName, network, balances);
        this.emitter.emit('balances', chainName, network, balances);
      });

      this.monitors[chainId] = chainMonitor;

      chainMonitor.start();
    }
  }

  public stop() {
    Object.values(this.monitors).forEach((manager) => manager.stop());
  }

  public on(event: string, listener: (...args: any[]) => void) {
    this.emitter.on(event, listener);
  }

  public metrics() {
    return this.exporter?.metrics();
  }

  public getRegistry() {
    return this.exporter?.getRegistry();
  }

  public getAllBalances(): Record<string, WalletBalancesByAddress> {
    const balances: Record<string, WalletBalancesByAddress> = {};

    for (const [chainName, manager] of Object.entries(this.monitors)) {
      balances[chainName] = manager.getBalances();
    }

    return balances;
  }

  public getChainBalances(chainId: ChainId): WalletBalancesByAddress {
    const manager = this.monitors[chainId];
    if (!manager) throw new Error(`No wallets configured for chain: ${coalesceChainName(chainId)}`);
    return manager.getBalances();
  }
}

abstract class ChainWalletMonitor {
  protected logger: Logger;
  protected balancesByAddress: WalletBalancesByAddress = {};
  private interval: ReturnType<typeof setInterval> | null = null;
  protected emitter = new EventEmitter();
  protected walletChainConfig: WalletChainConfig
  private pollInterval: number

  protected constructor(config: ChainWalletMonitorConfig, logger: Logger) {
    this.pollInterval = config.balancePollInterval
    this.logger = logger;
    this.walletChainConfig = config.walletChainConfig
  }

  static create(config: ChainWalletMonitorConfig, logger: Logger): ChainWalletMonitor {
    const chainId = config.walletChainConfig.chainId
    if (isEVMChain(chainId)) {
      return new EvmWalletMonitor(config, logger)
    }
    if (chainId === CHAIN_ID_ALEPHIUM) {
      return new AlephiumWalletMonitor(config, logger)
    }
    throw new Error(`Not supported: ${coalesceChainName(chainId)}`)
  }

  abstract fetchBalances(): Promise<WalletBalancesByAddress>

  async refreshBalances(): Promise<void> {
    try {
      this.balancesByAddress = await this.fetchBalances()
      this.emitter.emit('balances', this.balancesByAddress)
    } catch (error) {
      this.logger.error(`failed to refresh balances from ${coalesceChainName(this.walletChainConfig.chainId)}, error: ${error}`)
      this.emitter.emit('error', error)
    }
  }

  public on(event: string, listener: (...args: any[]) => void) {
    this.emitter.on(event, listener);
  }

  public async start() {
    this.logger.info(`Starting monitor for chain: ${coalesceChainName(this.walletChainConfig.chainId)}`);
    this.interval = setInterval(async () => {
      this.refreshBalances();
    }, this.pollInterval);

    this.refreshBalances();
  }

  public stop() {
    if (this.interval) clearInterval(this.interval);
  }

  public getBalances(): WalletBalancesByAddress {
    return this.balancesByAddress;
  }
}

class EvmWalletMonitor extends ChainWalletMonitor {
  private provider: ethers.providers.Provider

  constructor(config: ChainWalletMonitorConfig, logger: Logger) {
    super(config, logger)
    this.provider = newEVMProvider(config.nodeUrl)
  }

  getNativeTokenSymbol(): string {
    const chainId = this.walletChainConfig.chainId
    if (chainId === CHAIN_ID_ETH) {
      return 'ETH'
    }
    if (chainId === CHAIN_ID_BSC) {
      return 'BNB'
    }
    throw new Error(`Unknown evm chain: ${coalesceChainName(chainId)}`)
  }

  private async pullEVMNativeBalance(address: string): Promise<TokenBalance> {
    const weiAmount = await this.provider.getBalance(address);
    const balanceInNativeToken = ethers.utils.formatEther(weiAmount);
    return {
      isNative: true,
      rawBalance: weiAmount.toString(),
      formattedBalance: balanceInNativeToken,
      tokenId: '',
      symbol: this.getNativeTokenSymbol()
    }
  }

  private async pullAllEVMTokens(address: string, tokenAddresses: string[]): Promise<TokenBalance[]> {
    const nativeBalance = await this.pullEVMNativeBalance(address)
    const tokens = await Promise.all(tokenAddresses.map((tokenAddress) =>
      ethers_contracts.ERC20__factory.connect(tokenAddress, this.provider))
    )
    const tokenInfos = await Promise.all(
      tokens.map((token) => Promise.all([
        token.decimals(),
        token.balanceOf(address),
        token.symbol(),
      ])
    ))
    const balances = tokenInfos.map(([decimals, balance, symbol], idx) => ({
      isNative: false,
      rawBalance: balance.toString(),
      formattedBalance: formatUnits(balance, decimals),
      tokenId: tokenAddresses[idx],
      symbol: symbol
    }))
    return [nativeBalance, ...balances]
  }

  async fetchBalances(): Promise<WalletBalancesByAddress> {
    const allBalances: WalletBalancesByAddress = {}
    for (const wallet of this.walletChainConfig.wallets) {
      const tokenBalances = await this.pullAllEVMTokens(wallet.address, wallet.tokens)
      allBalances[wallet.address] = tokenBalances
    }
    return allBalances
  }
}

class AlephiumWalletMonitor extends ChainWalletMonitor {
  private provider: NodeProvider

  constructor(config: ChainWalletMonitorConfig, logger: Logger) {
    super(config, logger)
    this.provider = new NodeProvider(config.nodeUrl)
  }

  async fetchBalances(): Promise<WalletBalancesByAddress> {
    const allBalances: WalletBalancesByAddress = {}
    for (const wallet of this.walletChainConfig.wallets) {
      const tokenBalances: TokenBalance[] = []
      const balances = await this.provider.addresses.getAddressesAddressBalance(wallet.address)
      tokenBalances.push({
        isNative: true,
        rawBalance: balances.balance,
        formattedBalance: prettifyAttoAlphAmount(balances.balance)!.replace(',', ''),
        tokenId: ALPH_TOKEN_ID,
        symbol: 'ALPH'
      })

      for (const tokenId of wallet.tokens) {
        if (tokenId === ALPH_TOKEN_ID) {
          continue
        }
        const metadata = await this.provider.fetchFungibleTokenMetaData(tokenId)
        const tokenBalance = balances.tokenBalances?.find(t => t.id === tokenId)
        const amount = tokenBalance?.amount ?? '0'
        tokenBalances.push({
          isNative: false,
          rawBalance: amount,
          formattedBalance: prettifyTokenAmount(amount, metadata.decimals),
          tokenId: tokenId,
          symbol: metadata.symbol
        })
      }
      allBalances[wallet.address] = tokenBalances
    }
    return allBalances
  }
}

import Koa from 'koa';
import Router from 'koa-router';
import { Gauge, Registry } from 'prom-client';

import { TokenBalance, WalletBalancesByAddress } from './types';

export function updateBalancesGauge(gauge: Gauge, chainName: string, network: string, walletAddress: string, balance: TokenBalance) {
  const { symbol, tokenId, isNative } = balance;
  gauge
    .labels(chainName, network, symbol, isNative.toString(), tokenId, walletAddress)
    .set(parseFloat(balance.formattedBalance));
}

export function createBalancesGauge(registry: Registry, gaugeName: string) {
  return new Gauge({
    name: gaugeName,
    help: "Balances pulled for each configured wallet",
    labelNames: ["chain_name", "network", "symbol", "is_native", "token_id", "wallet_address"],
    registers: [registry],
  });
}

export function startMetricsServer (
  port: number, path: string, getMetrics: () => Promise<string>
): Promise<Koa> {
  const app = new Koa();
  const router = new Router();

  router.get(path, async (ctx: Koa.Context) => {
    ctx.body = await getMetrics();
  });

  app.use(router.routes());
  app.use(router.allowedMethods());

  return new Promise(resolve => {
    app.listen(port, () => {
      resolve(app);
    })
  });
}

export class PrometheusExporter {
  public app?: Koa;
  private balancesGauge: Gauge;
  private prometheusPort: number;
  private prometheusPath: string;
  private registry: Registry;

  constructor(port?: number, path?: string, registry?: Registry) {
    this.registry = registry || new Registry();
    this.prometheusPort = port || 9090;
    this.prometheusPath = path || '/metrics';
    this.balancesGauge = createBalancesGauge(this.registry, 'wallet_monitor_balance');
  }

  public getRegistry() {
    return this.registry;
  }

  public metrics() {
    return this.registry.metrics();
  }

  public updateBalances(chainName: string, network: string, balances: WalletBalancesByAddress) {
    Object.entries(balances).forEach((([walletAddress, balances]) => {
      balances.forEach((balance) => {
        updateBalancesGauge(this.balancesGauge, chainName, network, walletAddress, balance);
      })
    }))
  }

  public async startMetricsServer(): Promise<void> {
    this.app = await startMetricsServer(this.prometheusPort, this.prometheusPath, async () => {
      const metrics = await this.metrics()
      return metrics;
    });
  }
}

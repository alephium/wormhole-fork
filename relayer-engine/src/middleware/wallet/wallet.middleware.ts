import { ethers } from "ethers";
import { CHAIN_ID_TO_NAME, ChainId, EVMChainId, CHAIN_ID_ALEPHIUM } from "alephium-wormhole-sdk";
import { WalletToolBox } from "./walletToolBox";
import { Middleware } from "../../compose.middleware";
import { spawnWalletWorker } from "./wallet.worker";
import { Queue } from "@datastructures-js/queue";
import { ProviderContext, UntypedProvider } from "../providers.middleware";
import { Logger } from "winston";
import { TokensByChain, startWalletMonitor } from "./wallet.monitor";
import { Registry } from "prom-client";
import { NetworkId, SignerProvider } from "@alephium/web3";

export type EVMWallet = ethers.Wallet;
export type AlephiumWallet = SignerProvider;

export type Wallet =
  | EVMWallet
  | AlephiumWallet
  | UntypedWallet

export type UntypedWallet = UntypedProvider & {
  privateKey: string;
};

export interface Action<T, W extends Wallet> {
  chainId: ChainId;
  f: ActionFunc<T, W>;
}

export type ActionFunc<T, W extends Wallet> = (
  walletToolBox: WalletToolBox<W>,
  chaidId: ChainId,
) => Promise<T>;

export interface ActionWithCont<T, W extends Wallet> {
  action: Action<T, W>;
  pluginName: string;
  resolve: (t: T) => void;
  reject: (reason: any) => void;
}

export interface WorkerInfo {
  id: number;
  targetChainId: ChainId;
  targetChainName: string;
  walletPrivateKey: string;
}

export interface ActionExecutor {
  <T, W extends Wallet>(chaindId: ChainId, f: ActionFunc<T, W>): Promise<T>;
  onEVM<T>(chainId: EVMChainId, f: ActionFunc<T, EVMWallet>): Promise<T>;
  onAlephium<T>(f: ActionFunc<T, AlephiumWallet>): Promise<T>
}

function makeExecuteFunc(
  actionQueues: Map<ChainId, Queue<ActionWithCont<any, any>>>,
  pluginName: string,
  logger?: Logger,
): ActionExecutor {
  // push action onto actionQueue and have worker reject or resolve promise
  const func = <T, W extends Wallet>(
    chainId: ChainId,
    f: ActionFunc<T, W>,
  ): Promise<T> => {
    return new Promise((resolve, reject) => {
      const maybeQueue = actionQueues.get(chainId);
      if (!maybeQueue) {
        logger?.error(
          `Error making execute function. Unsupported chain: ${chainId}`,
        );
        return reject("Chain not supported");
      }
      maybeQueue.enqueue({
        action: { chainId, f },
        pluginName,
        resolve,
        reject,
      });
    });
  };
  func.onEVM = <T>(chainId: ChainId, f: ActionFunc<T, EVMWallet>) => func(chainId, f);
  func.onAlephium = <T>(f: ActionFunc<T, AlephiumWallet>) => func(CHAIN_ID_ALEPHIUM, f);
  return func;
}

export interface WalletContext extends ProviderContext {
  wallets: ActionExecutor;
}

export interface WalletOpts {
  namespace: string;
  privateKeys: Partial<{
    [k in ChainId]: any[];
  }>;
  logger: Logger;
  tokensByChain?: TokensByChain;
  addresses?: Partial<{
    [k in ChainId]: string[];
  }>;
  metrics?: {
    enabled: boolean;
    registry: Registry;
  };
}

export function wallets(
  networkId: NetworkId,
  opts: WalletOpts,
): Middleware<WalletContext> {
  const workerInfoMap = new Map<ChainId, WorkerInfo[]>(
    Object.entries(opts.privateKeys).map(([chainIdStr, keys]) => {
      //TODO update for all ecosystems
      let chainId = Number(chainIdStr) as ChainId;
      const workerInfos = keys.map((key, id) => ({
        id,
        targetChainId: chainId,
        targetChainName: CHAIN_ID_TO_NAME[chainId],
        walletPrivateKey: key,
      }));
      return [chainId, workerInfos];
    }),
  );

  if (opts.metrics) {
    startWalletMonitor(
      networkId,
      opts.addresses ?? {},
      opts.logger,
      opts.tokensByChain,
      opts.metrics
    );
  }

  let executeFunction: ActionExecutor;
  return async (ctx: WalletContext, next) => {
    if (!executeFunction) {
      ctx.logger?.debug(`Initializing wallets...`);
      const actionQueues = new Map<ChainId, Queue<ActionWithCont<any, any>>>();
      for (const [chain, workerInfos] of workerInfoMap.entries()) {
        const actionQueue = new Queue<ActionWithCont<any, any>>();
        actionQueues.set(chain, actionQueue);
        workerInfos.forEach(info =>
          spawnWalletWorker(actionQueue, ctx.providers, info, opts.logger),
        );
      }
      executeFunction = makeExecuteFunc(
        actionQueues,
        opts.namespace ?? "default",
        opts.logger,
      );
      ctx.logger?.debug(`Initialized wallets`);
    }

    ctx.logger?.debug("wallets attached to context");
    ctx.wallets = executeFunction;
    await next();
  };
}

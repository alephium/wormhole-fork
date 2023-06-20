import { Middleware } from "../compose.middleware";
import { Context } from "../context";
import { CHAIN_ID_BSC, CHAIN_ID_ETH, ChainId, EVMChainId, isEVMChain, CHAIN_ID_ALEPHIUM } from "alephium-wormhole-sdk";
import { ethers } from "ethers";
import { NetworkId, NodeProvider } from '@alephium/web3'
import { getNodeUrl, newEVMProvider } from "../utils";

export interface Providers {
  evm: Partial<Record<EVMChainId, ethers.providers.Provider[]>>;
  alephium: NodeProvider[];
  untyped: Partial<Record<ChainId, UntypedProvider[]>>;
}

export type UntypedProvider = {
  rpcUrl: string;
};

export interface ProviderContext extends Context {
  providers: Providers;
}

export type ChainConfigInfo = {
  [k in ChainId]: { endpoints: string[] }
};

export interface ProvidersOpts {
  chains: Partial<ChainConfigInfo>;
}

function getDefaultChainConfigs(networkId: NetworkId): Partial<ChainConfigInfo> {
  return {
    [CHAIN_ID_ALEPHIUM]: {
      endpoints: [getNodeUrl(networkId, CHAIN_ID_ALEPHIUM)]
    },
    [CHAIN_ID_ETH]: {
      endpoints: [getNodeUrl(networkId, CHAIN_ID_ETH)]
    },
    [CHAIN_ID_BSC]: {
      endpoints: [getNodeUrl(networkId, CHAIN_ID_BSC)]
    }
  }
}

/**
 * providers is a middleware that populates `ctx.providers` with provider information
 * @param opts
 */
export function providers(opts?: ProvidersOpts): Middleware<ProviderContext> {
  let providers: Providers;

  return async (ctx: ProviderContext, next) => {
    if (!providers) {
      ctx.logger?.debug(`Providers initializing...`);
      providers = await buildProviders(ctx.networkId, opts);
      ctx.logger?.debug(`Providers Initialized`);
    }
    ctx.providers = providers;
    ctx.logger?.debug("Providers attached to context");
    await next();
  };
}

async function buildProviders(
  networkId: NetworkId,
  opts?: ProvidersOpts,
): Promise<Providers> {
  const providers: Providers = {
    evm: {},
    alephium: [],
    untyped: {}
  }
  const chains = opts?.chains ?? getDefaultChainConfigs(networkId)
  for (const [chainIdStr, chainCfg] of Object.entries(chains)) {
    const chainId = Number(chainIdStr) as ChainId
    const { endpoints } = chainCfg
    if (isEVMChain(chainId)) {
      providers.evm[chainId] = endpoints.map(url => newEVMProvider(url))
    } else if (chainId === CHAIN_ID_ALEPHIUM) {
      providers.alephium = endpoints.map((e) => new NodeProvider(e))
    } else {
      providers.untyped[chainId] = endpoints.map(c => ({ rpcUrl: c }));
    }
  }
  return providers
}

/// <reference lib="dom" />
import { Middleware } from "../compose.middleware";
import { Context } from "../context";
import { sleep } from "../utils";
import { ChainId, isEVMChain } from "@alephium/wormhole-sdk";
import { Logger } from "winston";
import { NetworkId } from "@alephium/web3";

export interface SourceTxOpts {
  explorerApiServerEndpoint: string;
  retries: number;
}

export interface SourceTxContext extends Context {
  sourceTxHash?: string;
}

export const explorerApiServerEndpoints: { [k in NetworkId]: string | undefined } = {
  ['mainnet']: "https://indexer-api.explorer.bridge.alephium.org",
  ['testnet']: "https://v2.indexer-api.explorer.testnet.bridge.alephium.org",
  ['devnet']: "https://localhost:8100",
};

const defaultOptsByNetwork: { [k in NetworkId]: Partial<SourceTxOpts> } = {
  ['mainnet']: {
    explorerApiServerEndpoint: explorerApiServerEndpoints['mainnet'],
    retries: 5,
  },
  ['testnet']: {
    explorerApiServerEndpoint: explorerApiServerEndpoints['testnet'],
    retries: 3,
  },
  ['devnet']: {
    explorerApiServerEndpoint: explorerApiServerEndpoints['devnet'],
    retries: 3,
  },
};

export function sourceTx(
  optsWithoutDefaults?: SourceTxOpts,
): Middleware<SourceTxContext> {
  let opts: SourceTxOpts;
  return async (ctx, next) => {
    if (!opts) {
      // initialize options now that we know the network from context
      opts = Object.assign({}, defaultOptsByNetwork[ctx.networkId], optsWithoutDefaults);
    }

    const { emitterChain, emitterAddress, targetChain, sequence } = ctx.vaa.id;
    ctx.logger?.debug("Fetching tx hash...");
    let txHash = await fetchVaaHash(
      emitterChain,
      emitterAddress,
      targetChain,
      sequence,
      ctx.logger,
      ctx.networkId,
      opts.retries,
      opts.explorerApiServerEndpoint,
    );
    ctx.logger?.debug(
      txHash === ""
        ? "Could not retrive tx hash."
        : `Retrieved tx hash: ${txHash}`,
    );
    ctx.sourceTxHash = txHash;
    await next();
  };
}

export async function fetchVaaHash(
  emitterChain: number,
  emitterAddress: string,
  targetChain: number,
  sequence: string,
  logger: Logger,
  networkId: NetworkId,
  retries: number = 3,
  baseEndpoint: string = explorerApiServerEndpoints[networkId],
) {
  let attempt = 0;
  let txHash = "";
  do {
    try {
      const res = await fetch(
        `${baseEndpoint}/api/v1/vaas/${emitterChain}/${emitterAddress}/${targetChain}/${sequence}`,
      );
      if (res.status === 404) {
        throw new Error("Not found yet.");
      } else if (res.status > 500) {
        throw new Error(`Got: ${res.status}`);
      }
      txHash = (await res.json()).data?.txId;
    } catch (e) {
      logger?.error(
        `could not obtain txHash, attempt: ${attempt} of ${retries}.`,
        e,
      );
      await sleep((attempt + 1) * 200); // linear wait
    }
  } while (++attempt < retries && !txHash);

  if (
    isEVMChain(emitterChain as ChainId) &&
    txHash &&
    !txHash.startsWith("0x")
  ) {
    txHash = `0x${txHash}`;
  }

  logger.debug("Source Transaction Hash: " + txHash || "Not Found");

  return txHash;
}

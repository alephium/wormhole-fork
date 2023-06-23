import * as grpcWebNodeHttpTransport from "@improbable-eng/grpc-web-node-http-transport";
import { Middleware } from "../../compose.middleware";
import { Context } from "../../context";
import Redis, { Cluster, RedisOptions } from "ioredis";
import { ChainId, getSignedVAAWithRetry } from "@alephium/wormhole-sdk";
import {
  defaultWormholeRpcs,
  ParsedVaaWithBytes,
  RelayerApp,
  RelayerEvents,
} from "../../application";
import { Logger } from "winston";
import { createPool, Pool } from "generic-pool";
import { mapConcurrent, minute, sleep, SUPPORTED_CHAINS } from "../../utils";
import { RedisConnectionOpts } from "../../storage/redis-storage";
import { GetSignedVAAResponse } from "@alephium/wormhole-sdk/lib/cjs/proto/publicrpc/v1/publicrpc";

const IN_PROGRESS_TIMEOUT = 5 * minute;

export type { RedisOptions };
export interface MissedVaaOpts extends RedisConnectionOpts {
  checkForMissedVaasEveryMs?: number;
  wormholeRpcs?: string[];
  logger?: Logger;
}

export interface VaaKey {
  emitterChain: number;
  emitterAddress: string;
  targetChain: number;
  seq: bigint;
}

type FetchVaaFn = (vaa: VaaKey) => Promise<GetSignedVAAResponse>;
type ProcessVaaFn = (x: Buffer) => Promise<void>;
type TryFetchAndProcessFn = (
  redis: Redis | Cluster,
  vaaKey: VaaKey,
  logger?: Logger,
) => Promise<boolean>;

/**
 * Storage schema
 * chain/emitter -> sortedSet -> seq
 *
 * Job:
 * - requery for missed vaas
 * - query next vaa
 *
 * Middleware
 * - requery for missed vaas since last seen (not all)
 */

export function missedVaas(
  app: RelayerApp<any>,
  opts: MissedVaaOpts,
): Middleware {
  // set defaults
  opts.redis = opts.redis || { host: "localhost", port: 6379 };
  opts.redis.keyPrefix = opts.namespace;
  opts.wormholeRpcs = opts.wormholeRpcs ?? defaultWormholeRpcs[app.networkId];

  const redisPool = createRedisPool(opts);

  // mark vaa processed when app emits "Added" event
  app.addListener(RelayerEvents.Added, (vaa: ParsedVaaWithBytes) => {
    redisPool.use(redis =>
      markProcessed(
        redis,
        {
          emitterAddress: vaa.id.emitterAddress,
          emitterChain: vaa.id.emitterChain,
          targetChain: vaa.id.targetChain,
          seq: vaa.parsed.body.sequence
        },
        opts.logger,
      ),
    );
  });

  // construct dependency
  const fetchVaaFn = (vaaKey: VaaKey) => fetchVaa(opts.wormholeRpcs, vaaKey);

  // start worker
  setTimeout(() => startMissedVaaWorker(redisPool, app, fetchVaaFn, opts), 100); // start worker once config is done.

  // return noop middleware
  return async (ctx: Context, next) => next();
}

// Background job to ensure no vaas are missed
async function startMissedVaaWorker(
  pool: Pool<Cluster | Redis>,
  app: RelayerApp<any>,
  fetchVaaFn: FetchVaaFn,
  opts: {
    logger?: Logger;
    checkForMissedVaasEveryMs?: number;
  },
) {
  const filters = app.filters.flatMap((filter) => {
    const targetChains = SUPPORTED_CHAINS.filter((chainId) => chainId !== filter.emitterFilter.chainId)
    return targetChains.map((targetChain) => ({
      emitterFilter: {
        emitterChain: filter.emitterFilter.chainId,
        emitterAddress: filter.emitterFilter.emitterAddress,
        targetChain: targetChain
      }
    }))
  })
  while (true) {
    await pool
      .use(redis =>
        missedVaaJob(
          redis,
          filters,
          (redis: Redis | Cluster, vaaKey: VaaKey) =>
            tryFetchAndProcess(
              app.processVaa.bind(app),
              fetchVaaFn,
              redis,
              vaaKey,
              opts.logger,
            ),
          opts.logger,
        ),
      )
      .catch(e => opts.logger?.error(`error managing redis pool.`, e));
    await sleep(opts.checkForMissedVaasEveryMs || 30_000);
  }
}

// Job that for each registered (emitterChain, emitterAddress) pair:
// - refetches and processes all sequence numbers not marked seen or in progress since initial sequence
// - looks ahead for unseen sequences
export async function missedVaaJob(
  redis: Redis | Cluster,
  filters: {
    emitterFilter?: {
      emitterChain?: ChainId;
      emitterAddress?: string;
      targetChain?: ChainId;
    };
  }[],
  tryFetchAndProcess: TryFetchAndProcessFn,
  logger?: Logger,
) {
  try {
    logger?.debug(`Checking for missed VAAs`);

    const addressWithSeenSeqs = await mapConcurrent(filters, async filter => {
      const address = {
        emitterChain: filter.emitterFilter.emitterChain,
        emitterAddress: filter.emitterFilter.emitterAddress,
        targetChain: filter.emitterFilter.targetChain
      };
      const seenSeqs = await getSeenSeqs(redis, address.emitterChain, address.emitterAddress, address.targetChain);
      return { address, seenSeqs };
    });

    for (const {
      address: { emitterAddress, emitterChain, targetChain },
      seenSeqs,
    } of addressWithSeenSeqs) {
      if (seenSeqs.length === 0) {
        continue;
      }

      // comb over all seenSequences looking for gaps
      // note: seenSequences is in ascending order
      const missing = [] as bigint[];
      let idx = 0;
      let nextSeen = seenSeqs[0];
      for (let seq = seenSeqs[0]; seq < seenSeqs[seenSeqs.length - 1]; seq++) {
        if (seq === nextSeen) {
          nextSeen = seenSeqs[++idx];
          continue;
        }
        missing.push(seq);
        const vaaKey = {
          emitterAddress,
          emitterChain,
          targetChain,
          seq: seq,
        };
        await tryFetchAndProcess(redis, vaaKey, logger);
      }

      // look ahead of greatest seen sequence in case the next vaa was missed
      // continue looking ahead until a vaa can't be fetched
      for (let seq = seenSeqs[seenSeqs.length - 1] + 1n; true; seq++) {
        // iterate until fetchVaa throws because we couldn't find a next vaa.
        const vaaKey = {
          emitterAddress,
          emitterChain,
          targetChain,
          seq: seq,
        };
        const fetched = await tryFetchAndProcess(redis, vaaKey, logger);
        if (!fetched) {
          break;
        }
        missing.push(vaaKey.seq);
      }

      if (missing.length > 0) {
        logger?.info(
          `missedVaaWorker found ${missing.length} missed vaas ${JSON.stringify(
            {
              emitterAddress,
              emitterChain,
              targetChain,
              missedSequences: missing.map(seq => seq.toString()),
            },
          )}`,
        );
      }
    }
  } catch (e) {
    logger?.error(`startMissedVaaWorker loop failed with error`, e);
  }
}

// returns true if fetched and processed
export async function tryFetchAndProcess(
  processVaa: ProcessVaaFn,
  fetchVaa: FetchVaaFn,
  redis: Redis | Cluster,
  key: VaaKey,
  logger?: Logger,
): Promise<boolean> {
  try {
    const isInProgress = await fetchIsInProgress(redis, key, logger);
    if (isInProgress) {
      // short circuit is missedVaa middleware has already detected this vaa
      return false;
    }
    const fetchedVaa = await fetchVaa(key);
    logger?.info(
      `Possibly missed a vaa, adding to queue.`,
      vaaKeyReadable(key),
    );

    // before re-triggering middleware, mark key as in progress to avoid recursion
    await markInProgress(redis, key, logger);
    // push the missed vaa through all the middleware / storage service if used.
    processVaa(Buffer.from(fetchedVaa.vaaBytes));
    return true;
  } catch (e) {
    // code 5 means vaa not found in store
    if (e.code !== 5) {
      logger?.error(
        `Could not process missed vaa. Sequence: ${key.seq.toString()}`,
        e,
      );
    }
    return false;
  }
}

/*
 * Storage Helpers
 */

export async function markInProgress(
  redis: Redis | Cluster,
  keyObj: VaaKey,
  logger: Logger,
) {
  const key = getInProgressKey(keyObj);
  try {
    await redis
      .multi()
      .set(key, new Date().toString())
      .expire(key, IN_PROGRESS_TIMEOUT)
      .exec();
  } catch (e) {
    logger.error("could not mark sequence seen", e);
  }
}

async function fetchIsInProgress(
  redis: Redis | Cluster,
  keyObj: VaaKey,
  logger: Logger,
): Promise<boolean> {
  const key = getInProgressKey(keyObj);
  try {
    const raw = await redis.get(key);
    if (!raw) {
      return false;
    }
    return new Date(raw).getTime() > Date.now() - IN_PROGRESS_TIMEOUT;
  } catch (e) {
    logger.error("could not mark sequence as in progress", e);
    return false;
  }
}

async function getSeenSeqs(
  redis: Redis | Cluster,
  emitterChain: number,
  emitterAddress: string,
  targetChain: number
): Promise<bigint[]> {
  const key = getKey(emitterChain, emitterAddress, targetChain);
  const results = await redis.zrange(key, "-", "+", "BYLEX");
  const sequences = results.map(BigInt).sort((a, b) => Number(a - b));
  if (sequences.length <= 1) return sequences
  const removedSeqs: bigint[] = []
  for (let i = 1; i < sequences.length; i++) {
    const current = sequences[i]
    const prev = sequences[i - 1]
    if (current === prev + 1n) {
      removedSeqs.push(prev)
    } else {
      break
    }
  }
  if (removedSeqs.length !== 0) {
    const key = getKey(emitterChain, emitterAddress, targetChain)
    await redis.zrem(key, removedSeqs.map((seq) => seq.toString()))
  }
  return sequences.slice(removedSeqs.length)
}

export async function markProcessed(
  redis: Redis | Cluster,
  { emitterAddress, emitterChain, targetChain, seq }: VaaKey,
  logger: Logger,
): Promise<void> {
  try {
    await redis.zadd(getKey(emitterChain, emitterAddress, targetChain), 0, seq.toString());
  } catch (e) {
    logger?.error("could not mark sequence seen", e);
  }
}

function getKey(emitterChain: number, emitterAddress: string, targetChain: number): string {
  return `missedVaasV2:${emitterChain}:${emitterAddress}:${targetChain}`;
}

function getInProgressKey({
  emitterChain,
  emitterAddress,
  targetChain,
  seq,
}: VaaKey): string {
  return `missedVaasInProgress:${emitterChain}:${emitterAddress}:${targetChain}:${seq.toString()}`;
}

/*
 * Utils
 */

export function createRedisPool(
  opts: RedisConnectionOpts,
): Pool<Redis | Cluster> {
  const factory = {
    create: async function () {
      const redis = opts.redisCluster
        ? new Redis.Cluster(opts.redisClusterEndpoints, opts.redisCluster)
        : new Redis(opts.redis);
      return redis;
    },
    destroy: async function (redis: Redis | Cluster) {
      // do something when destroyed?
    },
  };
  const poolOpts = {
    min: 5,
    max: 15,
    autostart: true,
  };
  return createPool(factory, poolOpts);
}

function vaaKeyReadable(key: VaaKey): {
  emitterAddress: string;
  emitterChain: string;
  targetChain: string;
  sequence: string;
} {
  return {
    emitterAddress: key.emitterAddress,
    emitterChain: key.emitterChain.toString(),
    targetChain: key.targetChain.toString(),
    sequence: key.seq.toString(),
  };
}

async function fetchVaa(
  rpc: string[],
  { emitterChain, emitterAddress, targetChain, seq }: VaaKey,
) {
  return await getSignedVAAWithRetry(
    rpc,
    emitterChain as ChainId,
    emitterAddress,
    targetChain as ChainId,
    seq.toString(),
    { transport: grpcWebNodeHttpTransport.NodeHttpTransport() },
    100,
    2,
  );
}

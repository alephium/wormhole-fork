import {
  ChainId,
  hexToUint8Array,
  VAA,
  TransferToken,
  uint8ArrayToHex,
  deserializeVAA
} from "alephium-wormhole-sdk";
import { Mutex } from "async-mutex";
import { createClient, RedisClientType } from "redis";
import { getCommonEnvironment } from "../configureEnv";
import { chainIDStrings } from "../utils/wormhole";
import { getScopedLogger } from "./logHelper";
import { PromHelper } from "./promHelpers";
import { sleep } from "./utils";

const logger = getScopedLogger(["redisHelper"]);
const commonEnv = getCommonEnvironment();
const { redisHost, redisPort } = commonEnv;
let promHelper: PromHelper;

//Module internals
const redisMutex = new Mutex();
let redisQueue = new Array<[string, string]>();

export function getBackupQueue() {
  return redisQueue;
}

export enum RedisTables {
  INCOMING = 0,
  WORKING = 1,
}

export function init(ph: PromHelper): boolean {
  logger.info(`Will connect to redis at [${redisHost}:${redisPort}]`);
  promHelper = ph;
  return true;
}

export async function connectToRedis() {
  let rClient;
  try {
    rClient = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
      },
    });

    rClient.on("connect", function (err) {
      if (err) {
        logger.error(`Failed to connect to host ${redisHost}:${redisPort}, error: ${err}`)
      }
    });

    await rClient.connect();
  } catch (e) {
    logger.error(`Failed to connect to host ${redisHost}:${redisPort}, error: ${e}`)
  }

  return rClient;
}

export async function storeInRedis(name: string, value: string) {
  if (!name) {
    logger.error('Failed to store to redis: missing name')
    return
  }
  if (!value) {
    logger.error('Failed to store to redis: missing value')
    return
  }

  await redisMutex.runExclusive(async () => {
    logger.debug('Connecting to redis (storeInRedis)')
    let redisClient;
    try {
      redisQueue.push([name, value]);
      redisClient = await connectToRedis();
      if (!redisClient) {
        logger.error(`Failed to connect to redis, enqueued vaa, there are now ${redisQueue.length} enqueued events`)
        return
      }

      logger.debug(`Connected to redis, attempting to push ${redisQueue.length} queued items`)
      for (let item = redisQueue.pop(); item; item = redisQueue.pop()) {
        await addToRedis(redisClient, item[0], item[1]);
      }
    } catch (e) {
      logger.error(`Failed during redis item push. Currently ${redisQueue.length} enqueued items, error: ${e}`)
    }

    try {
      if (redisClient) {
        await redisClient.quit();
      }
    } catch (e) {
      logger.error("Failed to quit redis client");
    }
  });

  promHelper.handleListenerMemqueue(redisQueue.length);
}

export async function addToRedis(
  redisClient: any,
  name: string,
  value: string
) {
  try {
    logger.debug(`Storing in redis. name: ${name}`);
    await redisClient.select(RedisTables.INCOMING);
    await redisClient.set(name, value);

    logger.debug('Finished storing in redis');
  } catch (e) {
    logger.error(`Failed to store to redis ${redisHost}:${redisPort}, error: ${e}`);
  }
}

export function getKey(chainId: ChainId, address: string) {
  return chainId + ":" + address;
}

export enum Status {
  Pending = 1,
  Completed = 2,
  Error = 3,
  FatalError = 4,
}

export type RelayResult = {
  status: Status;
  result: string | null;
};

export type WorkerInfo = {
  index: number;
  targetChainId: ChainId;
  walletPrivateKey: string;
};

export type StoreKey = {
  emitterChainId: ChainId;
  targetChainId: ChainId;
  emitterAddress: string;
  sequence: number;
};

export type StorePayload = {
  vaaBytes: string;
  status: Status;
  timestamp: string;
  retries: number;
};

export function initPayload(): StorePayload {
  return {
    vaaBytes: "",
    status: Status.Pending,
    timestamp: new Date().toISOString(),
    retries: 0,
  };
}
export function initPayloadWithVAA(vaaBytes: string): StorePayload {
  const sp: StorePayload = initPayload();
  sp.vaaBytes = vaaBytes;
  return sp;
}

export function storeKeyFromParsedVAA(
  parsedVAA: VAA<TransferToken>
): StoreKey {
  return {
    emitterChainId: parsedVAA.body.emitterChainId,
    emitterAddress: uint8ArrayToHex(parsedVAA.body.emitterAddress),
    targetChainId: parsedVAA.body.targetChainId,
    sequence: Number(parsedVAA.body.sequence),
  };
}

export function storeKeyToJson(storeKey: StoreKey): string {
  return JSON.stringify(storeKey);
}

export function storeKeyFromJson(json: string): StoreKey {
  return JSON.parse(json);
}

export function storePayloadToJson(storePayload: StorePayload): string {
  return JSON.stringify(storePayload);
}

export function storePayloadFromJson(json: string): StorePayload {
  return JSON.parse(json);
}

export function resetPayload(storePayload: StorePayload): StorePayload {
  return initPayloadWithVAA(storePayload.vaaBytes);
}

export async function pushVaaToRedis(
  parsedVAA: VAA<TransferToken>,
  hexVaa: string
) {
  const transferPayload = parsedVAA.body.payload;

  logger.info(
    "Forwarding vaa to relayer: emitter: [" +
      parsedVAA.body.emitterChainId +
      ":" +
      uint8ArrayToHex(parsedVAA.body.emitterAddress) +
      "], seqNum: " +
      parsedVAA.body.sequence +
      ", payload: origin: [" +
      transferPayload.originChain +
      ":" +
      uint8ArrayToHex(transferPayload.originAddress) +
      "], target: [" +
      parsedVAA.body.targetChainId +
      ":" +
      uint8ArrayToHex(transferPayload.targetAddress) +
      "],  amount: " +
      transferPayload.amount +
      "],  fee: " +
      transferPayload.fee +
      ", "
  );
  const storeKey = storeKeyFromParsedVAA(parsedVAA);
  const storePayload = initPayloadWithVAA(hexVaa);

  logger.debug(
    "Storing: key: [" +
      storeKey.emitterChainId +
      "/" +
      storeKey.emitterAddress +
      "/" +
      storeKey.targetChainId +
      "/" +
      storeKey.sequence +
      "], payload: [" +
      storePayloadToJson(storePayload) +
      "]"
  );

  await storeInRedis(
    storeKeyToJson(storeKey),
    storePayloadToJson(storePayload)
  );
}

export async function clearRedis() {
  const redisClient = await connectToRedis();
  if (!redisClient) {
    logger.error("Failed to connect to redis to clear tables.");
    return;
  }
  await redisClient.FLUSHALL();
  redisClient.quit();
}

export async function demoteWorkingRedis() {
  const redisClient = await connectToRedis();
  if (!redisClient) {
    logger.error("Failed to connect to redis to clear tables.");
    return;
  }
  await redisClient.select(RedisTables.WORKING);
  for await (const si_key of redisClient.scanIterator()) {
    const si_value = await redisClient.get(si_key);
    if (!si_value) {
      continue;
    }
    logger.info("Demoting %s", si_key);
    await redisClient.del(si_key);
    await redisClient.select(RedisTables.INCOMING);
    await redisClient.set(
      si_key,
      storePayloadToJson(resetPayload(storePayloadFromJson(si_value)))
    );
    await redisClient.select(RedisTables.WORKING);
  }
  redisClient.quit();
}

type SourceToTargetMap = {
  [key in ChainId]: {
    [key in ChainId]: number;
  };
};

export function createSourceToTargetMap(
  knownChainIds: ChainId[]
): SourceToTargetMap {
  const sourceToTargetMap: SourceToTargetMap = {} as SourceToTargetMap;
  for (const sourceKey of knownChainIds) {
    sourceToTargetMap[sourceKey] = {} as { [key in ChainId]: number };
    for (const targetKey of knownChainIds) {
      sourceToTargetMap[sourceKey][targetKey] = 0;
    }
  }
  return sourceToTargetMap;
}

export async function incrementSourceToTargetMap(
  key: string,
  redisClient: RedisClientType<any>,
  sourceToTargetMap: SourceToTargetMap
): Promise<void> {
  const parsedKey = storeKeyFromJson(key);
  const siValue = await redisClient.get(key);
  if (!siValue) {
    return;
  }
  const signedVAA = hexToUint8Array(storePayloadFromJson(siValue).vaaBytes)
  const vaa = deserializeVAA(signedVAA)
  
  if (
    sourceToTargetMap[parsedKey.emitterChainId as ChainId]?.[
      vaa.body.targetChainId
    ] !== undefined
  ) {
    sourceToTargetMap[parsedKey.emitterChainId as ChainId][
      vaa.body.targetChainId
    ]++;
  }
}

export async function monitorRedis(metrics: PromHelper) {
  const scopedLogger = getScopedLogger(["monitorRedis"], logger);
  const TEN_SECONDS: number = 10000;
  const knownChainIds = Object.keys(chainIDStrings).map(
    (c) => Number(c) as ChainId
  );
  while (true) {
    const redisClient = await connectToRedis();
    if (!redisClient) {
      scopedLogger.error("Failed to connect to redis!");
    } else {
      try {
        await redisClient.select(RedisTables.INCOMING);
        const incomingSourceToTargetMap =
          createSourceToTargetMap(knownChainIds);
        for await (const si_key of redisClient.scanIterator()) {
          incrementSourceToTargetMap(
            si_key,
            redisClient,
            incomingSourceToTargetMap
          );
        }
        for (const sourceKey of knownChainIds) {
          for (const targetKey of knownChainIds) {
            metrics.setRedisQueue(
              RedisTables.INCOMING,
              sourceKey,
              targetKey,
              incomingSourceToTargetMap[sourceKey][targetKey]
            );
          }
        }
        await redisClient.select(RedisTables.WORKING);
        const workingSourceToTargetMap = createSourceToTargetMap(knownChainIds);
        for await (const si_key of redisClient.scanIterator()) {
          incrementSourceToTargetMap(
            si_key,
            redisClient,
            workingSourceToTargetMap
          );
        }
        for (const sourceKey of knownChainIds) {
          for (const targetKey of knownChainIds) {
            metrics.setRedisQueue(
              RedisTables.WORKING,
              sourceKey,
              targetKey,
              workingSourceToTargetMap[sourceKey][targetKey]
            );
          }
        }
      } catch (e) {
        scopedLogger.error("Failed to get dbSize and set metrics!");
      }
      try {
        redisClient.quit();
      } catch (e) {}
    }
    await sleep(TEN_SECONDS);
  }
}

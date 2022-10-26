import { ChainId } from "alephium-wormhole-sdk";
import { getRelayerEnvironment, RelayerEnvironment, validateRelayerConfig } from "../configureEnv";
import { getLogger, getScopedLogger, ScopedLogger } from "../helpers/logHelper";
import { PromHelper } from "../helpers/promHelpers";
import {
  clearRedis,
  connectToRedis,
  demoteWorkingRedis,
  monitorRedis,
  RedisTables,
  RelayResult,
  resetPayload,
  Status,
  storeKeyFromJson,
  StorePayload,
  storePayloadFromJson,
  storePayloadToJson,
  WorkerInfo,
} from "../helpers/redisHelper";
import { sleep } from "../helpers/utils";
import { relay } from "./relay";

const WORKER_THREAD_RESTART_MS = 10 * 1000;
const AUDITOR_THREAD_RESTART_MS = 10 * 1000;
const AUDIT_INTERVAL_MS = 30 * 1000;
const WORKER_INTERVAL_MS = 5 * 1000;
const REDIS_RETRY_MS = 10 * 1000;

const BACKOFF_TIME = 1000; // 1 second in milliseconds
const MAX_BACKOFF_TIME = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
const MAX_RETRIES = 10;

let metrics: PromHelper;

const logger = getLogger();
let relayerEnv: RelayerEnvironment;

type WorkableItem = {
  key: string;
  value: string;
};

export function init(): boolean {
  try {
    relayerEnv = getRelayerEnvironment();
  } catch (e) {
    logger.error(
      "Encountered error while initiating the relayer environment: " + e
    );
    return false;
  }

  return true;
}

function createWorkerInfos(metrics: PromHelper) {
  let workerArray: WorkerInfo[] = new Array();
  let index = 0;
  relayerEnv.supportedChains.forEach((chain) => {
    // initialize per chain metrics
    metrics.incSuccesses(chain.chainId, 0);
    metrics.incConfirmed(chain.chainId, 0);
    metrics.incFailures(chain.chainId, 0);
    metrics.incRollback(chain.chainId, 0);
    chain.walletPrivateKeys.forEach((key) => {
      workerArray.push({
        walletPrivateKey: key,
        index: index,
        targetChainId: chain.chainId,
      });
      index++;
    });
  });
  logger.info("will use " + workerArray.length + " workers");
  return workerArray;
}

async function spawnWorkerThreads(workerArray: WorkerInfo[]) {
  workerArray.forEach((workerInfo) => {
    spawnWorkerThread(workerInfo);
    spawnAuditorThread(workerInfo);
  });
}

async function spawnAuditorThread(workerInfo: WorkerInfo) {
  logger.info(
    "Spinning up auditor thread[" +
      workerInfo.index +
      "] to handle targetChainId " +
      workerInfo.targetChainId
  );

  //At present, due to the try catch inside the while loop, this thread should never crash.
  const auditorPromise = doAuditorThread(workerInfo).catch(
    async (error: Error) => {
      logger.error(
        "Fatal crash on auditor thread: index " +
          workerInfo.index +
          " chainId " +
          workerInfo.targetChainId
      );
      logger.error("error message: " + error.message);
      logger.error("error trace: " + error.stack);
      await sleep(AUDITOR_THREAD_RESTART_MS);
      spawnAuditorThread(workerInfo);
    }
  );

  return auditorPromise;
}

//One auditor thread should be spawned per worker. This is perhaps overkill, but auditors
//should not be allowed to block workers, or other auditors.
async function doAuditorThread(workerInfo: WorkerInfo) {
  const auditLogger = getScopedLogger([`audit-worker-${workerInfo.index}`]);
  while (true) {
    try {
      let redisClient: any = null;
      while (!redisClient) {
        redisClient = await connectToRedis();
        if (!redisClient) {
          auditLogger.error("Failed to connect to redis!");
          await sleep(REDIS_RETRY_MS);
        }
      }
      await redisClient.select(RedisTables.WORKING);
      for await (const siKey of redisClient.scanIterator()) {
        const storeKey = storeKeyFromJson(siKey)
        if (storeKey.targetChainId !== workerInfo.targetChainId) {
          continue
        }

        const siValue = await redisClient.get(siKey);
        if (!siValue) {
          continue;
        }
        const storePayload: StorePayload = storePayloadFromJson(siValue);
        auditLogger.debug(
          "key %s => status: %s, timestamp: %s, retries: %d",
          siKey,
          Status[storePayload.status],
          storePayload.timestamp,
          storePayload.retries
        );
        // Let things sit in here for 10 minutes
        // After that:
        //    - Toss totally failed VAAs
        //    - Check to see if successful transactions were rolled back
        //    - Put roll backs into INCOMING table
        //    - Toss legitimately completed transactions
        const now = new Date();
        const old = new Date(storePayload.timestamp);
        const timeDelta = now.getTime() - old.getTime(); // delta is in mS
        const TEN_MINUTES = 600000;
        auditLogger.debug(
          "Checking timestamps:  now: " +
            now.toISOString() +
            ", old: " +
            old.toISOString() +
            ", delta: " +
            timeDelta
        );
        if (timeDelta > TEN_MINUTES) {
          // Deal with this item
          if (storePayload.status === Status.FatalError) {
            // Done with this failed transaction
            auditLogger.debug("Discarding FatalError.");
            await redisClient.del(siKey);
            continue;
          } else if (storePayload.status === Status.Completed) {
            // Check for rollback
            auditLogger.debug("Checking for rollback.");

            //TODO actually do an isTransferCompleted
            const rr = await relay(
              storePayload.vaaBytes,
              true,
              workerInfo.walletPrivateKey,
              auditLogger,
              metrics
            );

            await redisClient.del(siKey);
            if (rr.status === Status.Completed) {
              metrics.incConfirmed(workerInfo.targetChainId);
            } else {
              auditLogger.info("Detected a rollback on " + siKey);
              metrics.incRollback(workerInfo.targetChainId);
              // Remove this item from the WORKING table and move it to INCOMING
              await redisClient.select(RedisTables.INCOMING);
              await redisClient.set(
                siKey,
                storePayloadToJson(resetPayload(storePayloadFromJson(siValue)))
              );
              await redisClient.select(RedisTables.WORKING);
            }
          } else if (storePayload.status === Status.Error) {
            auditLogger.error("Received Error status.");
            continue;
          } else if (storePayload.status === Status.Pending) {
            auditLogger.error("Received Pending status.");
            continue;
          } else {
            auditLogger.error("Unhandled Status of " + storePayload.status);
            continue;
          }
        }
      }
      redisClient.quit();
      // metrics.setDemoWalletBalance(now.getUTCSeconds());
    } catch (e) {
      auditLogger.error("spawnAuditorThread: caught exception: " + e);
    }
    await sleep(AUDIT_INTERVAL_MS);
  }
}

export async function run(ph: PromHelper) {
  metrics = ph;
  await validateRelayerConfig()

  if (relayerEnv.clearRedisOnInit) {
    logger.info("Clearing REDIS as per tunable...");
    await clearRedis();
  } else if (relayerEnv.demoteWorkingOnInit) {
    logger.info("Demoting Working to Incoming as per tunable...");
    await demoteWorkingRedis();
  } else {
    logger.info("NOT clearing REDIS.");
  }

  let workerArray: WorkerInfo[] = createWorkerInfos(metrics);

  spawnWorkerThreads(workerArray);
  try {
    monitorRedis(metrics);
  } catch (e) {
    logger.error("Failed to kick off monitorRedis: " + e);
  }
}

async function processRequest(
  item: WorkableItem,
  myPrivateKey: any,
  relayLogger: ScopedLogger
) {
  const logger = getScopedLogger(["processRequest"], relayLogger);
  try {
    logger.debug("Processing request %s...", item.key);
    let payload: StorePayload = storePayloadFromJson(item.value);
    // Actually do the processing here and update status and time field
    let relayResult: RelayResult;
    try {
      if (payload.retries > 0) {
        logger.info(
          "Calling with vaa_bytes %s, retry %d",
          payload.vaaBytes,
          payload.retries
        );
      } else {
        logger.info("Calling with vaa_bytes %s", payload.vaaBytes);
      }
      relayResult = await relay(
        payload.vaaBytes,
        false,
        myPrivateKey,
        logger,
        metrics
      );
      logger.info("Relay returned: %o", Status[relayResult.status]);
    } catch (e: any) {
      if (e.message) {
        logger.error("Failed to relay transfer vaa: %s", e.message);
      } else {
        logger.error("Failed to relay transfer vaa: %o", e);
      }

      relayResult = {
        status: Status.Error,
        result: "Failure",
      };
      if (e && e.message) {
        relayResult.result = e.message;
      }
    }

    const storeKey = storeKeyFromJson(item.key)
    const targetChain = storeKey.targetChainId as ChainId
    let retry: boolean = false;
    if (relayResult.status !== Status.Completed) {
      metrics.incFailures(targetChain);
      if (payload.retries >= MAX_RETRIES) {
        relayResult.status = Status.FatalError;
      }
      if (relayResult.status === Status.FatalError) {
        // Invoke fatal error logic here!
        payload.retries = MAX_RETRIES;
      } else {
        // Invoke retry logic here!
        retry = true;
      }
    }

    // Put result back into store
    payload.status = relayResult.status;
    payload.timestamp = new Date().toISOString();
    payload.retries++;
    const newValue = storePayloadToJson(payload);

    const rClient = await connectToRedis();
    if (!rClient) {
      logger.error("Failed to connect to Redis in processRequest");
      return;
    }
    await rClient.select(RedisTables.WORKING);
    if (!retry || payload.retries > MAX_RETRIES) {
      await rClient.set(item.key, newValue);
    } else {
      // Remove from the working table
      await rClient.del(item.key);
      // Put this back into the incoming table
      await rClient.select(RedisTables.INCOMING);
      await rClient.set(item.key, newValue);
    }
    await rClient.quit();
  } catch (e: any) {
    logger.error("Unexpected error in processRequest: " + e.message);
    logger.error("request key: " + item.key);
    logger.error(e);
  }
}

// Redis does not guarantee ordering.  Therefore, it is possible that if workItems are
// pulled out one at a time, then some workItems could stay in the table indefinitely.
// This function gathers all the items available at this moment to work on.
async function findWorkableItems(
  workerInfo: WorkerInfo,
  relayLogger: ScopedLogger
): Promise<WorkableItem[]> {
  const logger = getScopedLogger(["findWorkableItems"], relayLogger);
  try {
    let workableItems: WorkableItem[] = [];
    const redisClient = await connectToRedis();
    if (!redisClient) {
      logger.error("Failed to connect to redis inside findWorkableItems()!");
      return workableItems;
    }
    await redisClient.select(RedisTables.INCOMING);
    for await (const si_key of redisClient.scanIterator()) {
      const si_value = await redisClient.get(si_key);
      if (si_value) {
        // Check to see if this worker should handle this VAA
        if (workerInfo.targetChainId !== 0) {
          const storeKey = storeKeyFromJson(si_key)
          if (storeKey.targetChainId !== workerInfo.targetChainId) {
            // Skipping mismatched chainId
            continue;
          }
        }

        // Check to see if this is a retry and if it is time to retry
        const storePayload: StorePayload = storePayloadFromJson(si_value);
        if (storePayload.retries > 0) {
          // calculate retry time
          const now: Date = new Date();
          const old: Date = new Date(storePayload.timestamp);
          const timeDelta: number = now.getTime() - old.getTime(); // delta is in mS
          const waitTime: number = Math.min(
            BACKOFF_TIME * 10 ** storePayload.retries, //First retry is 10 second, then 100, 1,000... Max of 4 hours.
            MAX_BACKOFF_TIME
          );
          if (timeDelta < waitTime) {
            // Not enough time has passed
            continue;
          }
        }
        workableItems.push({ key: si_key, value: si_value });
      }
    }
    redisClient.quit();
    return workableItems;
  } catch (e: any) {
    logger.error(
      "Recoverable exception scanning REDIS for workable items: " + e.message
    );
    logger.error(e);
    return [];
  }
}

//One worker should be spawned for each chainId+privateKey combo.
async function spawnWorkerThread(workerInfo: WorkerInfo) {
  logger.info(
    "Spinning up worker[" +
      workerInfo.index +
      "] to handle targetChainId " +
      workerInfo.targetChainId
  );

  const workerPromise = doWorkerThread(workerInfo).catch(async (error) => {
    logger.error(
      "Fatal crash on worker thread: index " +
        workerInfo.index +
        " chainId " +
        workerInfo.targetChainId
    );
    logger.error("error message: " + error.message);
    logger.error("error trace: " + error.stack);
    await sleep(WORKER_THREAD_RESTART_MS);
    spawnWorkerThread(workerInfo);
  });

  return workerPromise;
}

async function doWorkerThread(workerInfo: WorkerInfo) {
  const relayLogger = getScopedLogger([`relay-worker-${workerInfo.index}`]);
  while (true) {
    // relayLogger.debug("Finding workable items.");
    const workableItems: WorkableItem[] = await findWorkableItems(
      workerInfo,
      relayLogger
    );
    relayLogger.debug("Found items: %o", workableItems);
    for (let i = 0; i < workableItems.length; i++) {
      const workItem: WorkableItem = workableItems[i];
      if (workItem) {
        //This will attempt to move the workable item to the WORKING table
        relayLogger.debug("Moving item: %o", workItem);
        if (await moveToWorking(workItem, relayLogger)) {
          relayLogger.info("Moved key to WORKING table: %s", workItem.key);
          await processRequest(
            workItem,
            workerInfo.walletPrivateKey,
            relayLogger
          );
        } else {
          relayLogger.error(
            "Cannot move work item from INCOMING to WORKING: %s",
            workItem.key
          );
        }
      }
    }
    // relayLogger.debug(
    //   "Taking a break for %i seconds",
    //   WORKER_INTERVAL_MS / 1000
    // );
    await sleep(WORKER_INTERVAL_MS);
  }
}

async function moveToWorking(
  workItem: WorkableItem,
  relayLogger: ScopedLogger
): Promise<boolean> {
  const logger = getScopedLogger(["moveToWorking"], relayLogger);
  try {
    const redisClient = await connectToRedis();
    if (!redisClient) {
      logger.error("Failed to connect to Redis.");
      return false;
    }
    // Move this entry from incoming store to working store
    await redisClient.select(RedisTables.INCOMING);
    if ((await redisClient.del(workItem.key)) === 0) {
      logger.info("The key %s no longer exists in INCOMING", workItem.key);
      await redisClient.quit();
      return false;
    }
    await redisClient.select(RedisTables.WORKING);
    // If this VAA is already in the working store, then no need to add it again.
    // This handles the case of duplicate VAAs from multiple guardians
    const checkVal = await redisClient.get(workItem.key);
    if (!checkVal) {
      let payload: StorePayload = storePayloadFromJson(workItem.value);
      payload.status = Status.Pending;
      await redisClient.set(workItem.key, storePayloadToJson(payload));
      await redisClient.quit();
      return true;
    } else {
      metrics.incAlreadyExec();
      logger.debug("Dropping request %s as already processed", workItem.key);
      await redisClient.quit();
      return false;
    }
  } catch (e: any) {
    logger.error("Recoverable exception moving item to working: " + e.message);
    logger.error("%s => %s", workItem.key, workItem.value);
    logger.error(e);
    return false;
  }
}

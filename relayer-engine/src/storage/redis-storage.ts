import { Job, Queue, Worker } from "bullmq";
import { Logger } from "winston";
import {
  Cluster,
  ClusterNode,
  ClusterOptions,
  Redis,
  RedisOptions,
} from "ioredis";
import { createStorageMetrics } from "../storage.metrics";
import { Gauge, Histogram, Registry } from "prom-client";
import { parseVaaWithBytes, sleep } from "../utils";
import { onJobHandler, RelayJob, Storage } from "./storage";
import { KoaAdapter } from "@bull-board/koa";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { deserializeVAA, uint8ArrayToHex } from "@alephium/wormhole-sdk";
import { ParsedVaaWithBytes } from "../application";

export interface RedisConnectionOpts {
  redisClusterEndpoints?: ClusterNode[];
  redisCluster?: ClusterOptions;
  redis?: RedisOptions;
  namespace?: string;
}

export interface StorageOptions extends RedisConnectionOpts {
  queueName: string;
  attempts: number;
  concurrency?: number;
}

export type JobData = { vaaBytes: string };

const defaultOptions: Partial<StorageOptions> = {
  attempts: 3,
  redis: {},
  queueName: "relays",
  concurrency: 3,
};

export class RedisStorage implements Storage {
  logger: Logger;
  vaaQueue: Queue<JobData, string[], string>;
  private worker: Worker<JobData, void, string>;
  private readonly prefix: string;
  private readonly redis: Cluster | Redis;
  public registry: Registry;
  private metrics: {
    delayedGauge: Gauge<string>;
    waitingGauge: Gauge<string>;
    activeGauge: Gauge<string>;
    completedDuration: Histogram<string>;
    processedDuration: Histogram<string>;
  };
  private opts: StorageOptions;

  workerId: string;

  constructor(opts: StorageOptions) {
    this.opts = Object.assign({}, defaultOptions, opts);
    // ensure redis is defined
    if (!this.opts.redis) {
      this.opts.redis = {};
    }

    this.opts.redis.maxRetriesPerRequest = null; //Added because of: DEPRECATION WARNING! Your redis options maxRetriesPerRequest must be null. On the next versions having this settings will throw an exception
    this.prefix = `{${this.opts.namespace ?? this.opts.queueName}}`;
    this.redis =
      this.opts.redisClusterEndpoints?.length > 0
        ? new Redis.Cluster(
            this.opts.redisClusterEndpoints,
            this.opts.redisCluster,
          )
        : new Redis(this.opts.redis);
    this.vaaQueue = new Queue(this.opts.queueName, {
      prefix: this.prefix,
      connection: this.redis,
    });
    const { metrics, registry } = createStorageMetrics();
    this.metrics = metrics;
    this.registry = registry;
  }

  async addVaaToQueue(vaaBytes: Uint8Array): Promise<RelayJob> {
    const vaa = parseVaaWithBytes(vaaBytes);
    const id = this.vaaId(vaa);
    const idWithoutHash = id.substring(0, id.length - 6);
    this.logger?.debug(`Adding VAA to queue`, {
      emitterChain: vaa.id.emitterChain,
      emitterAddress: vaa.id.emitterAddress,
      targetChain: vaa.id.targetChain,
      sequence: vaa.id.sequence,
    });
    const job = await this.vaaQueue.add(
      idWithoutHash,
      {
        vaaBytes: Buffer.from(vaaBytes).toString("base64"),
      },
      {
        jobId: id,
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: this.opts.attempts,
      },
    );

    return {
      attempts: 0,
      data: { vaaBytes, parsedVaa: vaa.parsed },
      id: job.id,
      name: job.name,
      log: job.log.bind(job),
      updateProgress: job.updateProgress.bind(job),
      maxAttempts: this.opts.attempts,
    };
  }

  private vaaId(vaa: ParsedVaaWithBytes): string {
    const emitterAddress = uint8ArrayToHex(vaa.parsed.body.emitterAddress);
    const sequence = vaa.id.sequence;
    return `${vaa.id.emitterChain}/${emitterAddress}/${vaa.id.targetChain}/${sequence}`;
  }

  startWorker(handleJob: onJobHandler) {
    this.logger?.debug(
      `Starting worker for queue: ${this.opts.queueName}. Prefix: ${this.prefix}.`,
    );
    this.worker = new Worker(
      this.opts.queueName,
      async job => {
        this.logger?.debug(`Starting job: ${job.id}`);
        const vaaBytes = Buffer.from(job.data.vaaBytes, "base64");
        const relayJob: RelayJob = {
          attempts: job.attemptsMade,
          data: {
            vaaBytes,
            parsedVaa: deserializeVAA(vaaBytes),
          },
          id: job.id,
          maxAttempts: this.opts.attempts,
          name: job.name,
          log: job.log.bind(job),
          updateProgress: job.updateProgress.bind(job),
        };
        await job.log(`processing by..${this.workerId}`);
        await handleJob(relayJob);
        return;
      },
      {
        prefix: this.prefix,
        connection: this.redis,
        concurrency: this.opts.concurrency,
      },
    );
    this.workerId = this.worker.id;

    this.worker.on("completed", this.onCompleted.bind(this));
    this.spawnGaugeUpdateWorker();
  }

  async stopWorker() {
    await this.worker?.close();
    this.worker = null;
  }

  async spawnGaugeUpdateWorker(ms = 5000) {
    while (this.worker !== null) {
      await this.updateGauges();
      await sleep(ms);
    }
  }

  private async updateGauges() {
    const { active, delayed, waiting } = await this.vaaQueue.getJobCounts();
    this.metrics.activeGauge.labels({ queue: this.vaaQueue.name }).set(active);
    this.metrics.delayedGauge
      .labels({ queue: this.vaaQueue.name })
      .set(delayed);
    this.metrics.waitingGauge
      .labels({ queue: this.vaaQueue.name })
      .set(waiting);
  }

  private async onCompleted(job: Job) {
    const completedDuration = job.finishedOn! - job.timestamp!; // neither can be null
    const processedDuration = job.finishedOn! - job.processedOn!; // neither can be null
    this.metrics.completedDuration
      .labels({ queue: this.vaaQueue.name })
      .observe(completedDuration);
    this.metrics.processedDuration
      .labels({ queue: this.vaaQueue.name })
      .observe(processedDuration);
  }

  storageKoaUI(path: string) {
    // UI
    const serverAdapter = new KoaAdapter();
    serverAdapter.setBasePath(path);

    createBullBoard({
      queues: [new BullMQAdapter(this.vaaQueue)],
      serverAdapter: serverAdapter,
    });

    return serverAdapter.registerPlugin();
  }
}

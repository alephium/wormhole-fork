import {
  expect,
  jest,
  describe,
  test,
  beforeAll,
  afterAll,
  beforeEach,
} from "@jest/globals";
import {
  MissedVaaOpts,
  VaaKey,
  markInProgress,
  markProcessed,
  missedVaaJob,
  tryFetchAndProcess,
} from "./missedVaas.middleware";
import { CHAIN_ID_ALEPHIUM, CHAIN_ID_BSC } from "@alephium/wormhole-sdk";
import { Redis, Cluster } from "ioredis";
import { createLogger, format, transports, Logger } from "winston";
import { GetSignedVAAResponse } from "@alephium/wormhole-sdk/lib/cjs/proto/publicrpc/v1/publicrpc";

const logger = createLogger({
  level: "debug",
  transports: new transports.Console({ format: format.simple() }),
});

const opts: MissedVaaOpts = {
  redis: {
    host: "localhost",
    port: 6379,
    db: 1
  },
};

type ProcessVaaFn = (x: Buffer) => Promise<void>;
type FetchVaaFn = (vaa: VaaKey) => Promise<GetSignedVAAResponse>;

const emitterAddress = "0xEF179777F69cE855718Df64E2E84BBA99b6E4828";
const emitterChain = CHAIN_ID_BSC;
const targetChain = CHAIN_ID_ALEPHIUM;
const key = (seq: bigint) => ({ emitterAddress, emitterChain, targetChain, seq });
const filters = [
  {
    emitterFilter: {
      emitterChain,
      emitterAddress,
      targetChain
    },
  },
];

describe("missed vaa job", () => {
  // @ts-ignore
  let redis: Redis;
  beforeAll(() => {
    redis = new Redis(opts.redis!);
  });

  afterAll(() => redis.disconnect());

  beforeEach(() => redis.flushall());

  describe("missedVaaJob", () => {
    test("simple", async () => {
      const signed = [1n, 2n, 5n, 7n, 8n];
      const seen = [0n, 3n, 4n, 6n];

      // mark processed
      await Promise.all(
        seen.map(seq => markProcessed(redis, key(seq), logger)),
      );

      const tryFetchAndProcess = jest.fn(
        async (redis: Redis | Cluster, vaaKey: VaaKey, logger?: Logger) => {
          return signed.includes(vaaKey.seq);
        },
      );

      await missedVaaJob(redis, filters, tryFetchAndProcess, logger);

      expect(tryFetchAndProcess).toBeCalledTimes(6);

      const results = Promise.all(
        tryFetchAndProcess.mock.results.map(r => r.value),
      );
      expect(results).resolves.toStrictEqual([
        true,
        true,
        true,
        true,
        true,
        false,
      ]);
    });
  });

  describe("tryFetchAndProcess", () => {
    test("success", async () => {
      // mocks
      const fetchVaa: FetchVaaFn = jest.fn(async (vaaKey: VaaKey) => {
        if (true) {
          return { vaaBytes: new Uint8Array([Number(vaaKey.seq)]) };
        }
        throw vaaNotFound();
      });
      const processVaa: ProcessVaaFn = jest.fn(async (vaa: Buffer) =>
        Promise.resolve(),
      );

      const fetched = await tryFetchAndProcess(
        processVaa,
        fetchVaa,
        redis,
        key(5n),
        logger,
      );

      expect(fetched).toBeTruthy();
    });
    test("inProgress", async () => {
      markInProgress(redis, key(5n), logger);

      // mocks
      const fetchVaa: FetchVaaFn = jest.fn(async (vaaKey: VaaKey) => {
        if (true) {
          return { vaaBytes: new Uint8Array([Number(vaaKey.seq)]) };
        }
        throw vaaNotFound();
      });
      const processVaa: ProcessVaaFn = jest.fn(async (vaa: Buffer) =>
        Promise.resolve(),
      );

      const fetched = await tryFetchAndProcess(
        processVaa,
        fetchVaa,
        redis,
        key(5n),
        logger,
      );

      expect(fetched).toBeFalsy();
    });
    test("processVaa throws", async () => {
      // mocks
      const fetchVaa: FetchVaaFn = jest.fn(async (vaaKey: VaaKey) => {
        throw vaaNotFound();
      });
      const processVaa: ProcessVaaFn = jest.fn(async (vaa: Buffer) =>
        Promise.reject("bad processing!!!!"),
      );

      const fetched = await tryFetchAndProcess(
        processVaa,
        fetchVaa,
        redis,
        key(5n),
        logger,
      );

      expect(fetched).toBeFalsy();
    });
    test("fetch fails", async () => {
      // mocks
      const fetchVaa: FetchVaaFn = jest.fn(async (vaaKey: VaaKey) => {
        throw vaaNotFound();
      });
      const processVaa: ProcessVaaFn = jest.fn(async (vaa: Buffer) =>
        Promise.resolve(),
      );

      const fetched = await tryFetchAndProcess(
        processVaa,
        fetchVaa,
        redis,
        key(5n),
        logger,
      );

      expect(fetched).toBeFalsy();
    });
  });
});

const vaaNotFound = () => {
  let e = new Error("vaa not found") as any;
  e.code = 5;
  return e;
};

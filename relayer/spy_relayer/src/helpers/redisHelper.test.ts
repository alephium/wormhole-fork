process.env.LOG_LEVEL = "debug";
process.env.PROM_PORT = "0";
process.env.REDIS_HOST = "localhost";
process.env.REDIS_PORT = "0";

import { ChainId } from "alephium-wormhole-sdk";
import { chainIDStrings } from "../utils/wormhole";
import {
  createSourceToTargetMap,
  incrementSourceToTargetMap,
} from "./redisHelper";
const TEST_KEY = `{"emitterChainId":2,"targetChainId":255,"emitterAddress":"0000000000000000000000000290fb167208af455bb137780163b7b7a9a10c16","sequence":8}`;
const TEST_VAA_BYTES =
  "01000000000100395562a0e76ea4839f8b5085c73f876ae67b5538d212fb459662cf80170a51c062133bd18b03df1c5782a44aebb8e675af20e92feffdcc95077e00cc149fed60000000034231890000000200ff0000000000000000000000000290fb167208af455bb137780163b7b7a9a10c1600000000000000080101000000000000000000000000000000000000000000000000000000000dd687a00000000000000000000000002d8be6bf0baa74e0a907016679cae9190e80dd0a0002bee85f379545a2ed9f6cceb331288842f378cf0f04012ad4ac8824aae7d6f80a0000000000000000000000000000000000000000000000000000000000000000";
test("should correctly increment sourceToTargetMap", async () => {
  const knownChainIds = Object.keys(chainIDStrings).map(
    (c) => Number(c) as ChainId
  );
  const sourceToTargetMap = createSourceToTargetMap(knownChainIds);
  const redisClientMock: any = {
    get: async () => `{"vaaBytes":"${TEST_VAA_BYTES}"}`,
  };
  await incrementSourceToTargetMap(
    TEST_KEY,
    redisClientMock,
    sourceToTargetMap
  );
  expect(sourceToTargetMap[3][1]).toBe(0);
  expect(sourceToTargetMap[2][255]).toBe(1);
});

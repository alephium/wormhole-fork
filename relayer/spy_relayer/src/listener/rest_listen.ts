import { uint8ArrayToHex, VAA, TransferToken } from "alephium-wormhole-sdk";
import { Request, Response } from "express";
import { getListenerEnvironment, ListenerEnvironment } from "../configureEnv";
import { getLogger } from "../helpers/logHelper";
import { pushVaaToRedis } from "../helpers/redisHelper";
import { parseAndValidateVaa } from "./validation";

let logger = getLogger();
let env: ListenerEnvironment;

export function init(): boolean {
  try {
    env = getListenerEnvironment();
  } catch (e) {
    logger.error(`Encountered and error while initializing the listener environment: ${e}`)
    return false;
  }
  if (!env.restPort) {
    return true;
  }

  return true;
}

export async function run() {
  if (!env.restPort) return;

  const express = require("express");
  const cors = require("cors");
  const app = express();
  app.use(cors());
  app.listen(env.restPort, () =>
    logger.info(`Listening on REST port ${env.restPort}`)
  );

  (async () => {
    app.get("/relayvaa/:vaa", async (req: Request, res: Response) => {
      try {
        const vaaBuf = Uint8Array.from(Buffer.from(req.params.vaa, "base64"));
        const hexVaa = uint8ArrayToHex(vaaBuf);
        const validationResults: VAA<TransferToken> | string =
          await parseAndValidateVaa(vaaBuf);

        if (typeof validationResults === "string") {
          logger.debug("Rejecting REST request due validation failure");
          return;
        }

        pushVaaToRedis(validationResults, hexVaa);

        res.status(200).json({ message: "Scheduled" });
      } catch (e) {
        logger.error(`Failed to process rest relay of vaa request ${JSON.stringify(req)}, error: ${e}`)
        res.status(400).json({ message: "Request failed" });
      }
    });

    app.get("/", (req: Request, res: Response) =>
      res.json(["/relayvaa/<vaaInBase64>"])
    );
  })();
}

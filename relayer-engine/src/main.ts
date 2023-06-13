import * as dotenv from "dotenv"
import * as winston from "winston";
import { Logger } from "winston";
import { StandardRelayerApp, StandardRelayerContext } from "./application-standard";
import Koa from "koa";
import { Context, Next as KoaNext } from "koa";
import Router from "koa-router";
import { ParsedVaaWithBytes } from "./application";
import { relay } from "./relayer";
import { SUPPORTED_CHAINS } from "./utils";
import { Config, getConfig } from "./config";

dotenv.config()

const rootLogger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      level: "debug",
    })
  ],
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.splat(),
    winston.format.simple(),
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss.SSS",
    }),
    winston.format.errors({ stack: true })
  )
})

async function main() {
  let config: Config
  try {
    config = getConfig()
  } catch (error) {
    rootLogger.error(`${error}`)
    return
  }

  const app = new StandardRelayerApp<StandardRelayerContext>(config.networkId, {
    name: 'relayer',
    logger: rootLogger,
    privateKeys: config.privateKeys,
    addresses: config.addresses,
    spyEndpoint: config.spyUrl,
    redis: { host: config.redisHost, port: config.redisPort }
  })

  app.filter((vaa: ParsedVaaWithBytes) => {
    const payloadType = vaa.parsed.body.payload.type
    const targetChain = vaa.parsed.body.targetChainId
    return payloadType === 'TransferToken' && !config.skipChains.includes(targetChain)
  })

  app.tokenBridge(SUPPORTED_CHAINS, relay)

  app.listen()
  runAPI(app, rootLogger, config.apiPort)
  runMetrics(app, rootLogger, config.metricsPort)
}

function runAPI(relayerApp: StandardRelayerApp<any>, logger: Logger, port?: number) {
  const app = new Koa()
  const router = new Router()

  router.get(`/metrics`, async (ctx, next) => {
    ctx.body = await relayerApp.metricsRegistry.metrics()
  });

  router.post(
    `/vaas/:emitterChain/:emitterAddress/:targetChain/:sequence`,
    reprocessVaaById(rootLogger, relayerApp)
  )

  app.use(relayerApp.storageKoaUI("/ui"))

  app.use(router.routes())
  app.use(router.allowedMethods())

  const listenPort = port ?? 31000
  app.listen(listenPort, () => {
    logger.info(`running on ${listenPort}...`)
    logger.info(`for the UI, open http://localhost:${listenPort}/ui`)
    logger.info("make sure redis is running on port 6379 by default")
  })
}

function runMetrics(relayerApp: StandardRelayerApp<any>, logger: Logger, metricsPort?: number) {
  const app = new Koa()
  const router = new Router()

  router.get(`/metrics`, async (ctx, next) => {
    ctx.body = await relayerApp.metricsRegistry.metrics();
  })

  app.use(router.routes())
  app.use(router.allowedMethods())

  const port = metricsPort ?? 31001
  app.listen(port, () => {
    logger.info(`exposing metrics on ${port}...`)
  })
}

function reprocessVaaById(rootLogger: Logger, relayer: StandardRelayerApp) {
  return async (ctx: Context, _next: KoaNext) => {
    const { emitterChain, emitterAddress, targetChain, sequence } = ctx.params
    const logger = rootLogger.child({ emitterChain, emitterAddress, targetChain, sequence })
    logger.info("fetching vaa requested by API")
    let vaa = await relayer.fetchVaa(emitterChain, emitterAddress, targetChain, sequence)
    if (!vaa) {
      logger.error("failed to fetch vaa")
      return
    }
    relayer.retryProcessVaa(Buffer.from(vaa.bytes))
    ctx.body = "Processing"
  }
}

main()

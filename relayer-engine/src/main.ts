import * as dotenv from "dotenv"
import * as winston from "winston";
import { Logger } from "winston";
import { StandardRelayerApp, StandardRelayerContext } from "./application-standard";
import Koa from "koa";
import { Context, Next as KoaNext } from "koa";
import Router from "koa-router";
import { ParsedVaaWithBytes } from "./application";
import { relay } from "./relayer";
import { SUPPORTED_CHAINS, getAlephiumGroupIndex, getNodeUrl, getTokenBridgeAddress } from "./utils";
import { Config, getConfig } from "./config";
import { CHAIN_ID_ALEPHIUM, ChainId, getIsTransferCompletedAlph, getIsTransferCompletedBySequenceAlph, getTokenBridgeForChainId } from "@alephium/wormhole-sdk";
import { web3 } from "@alephium/web3";

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

  const alphNodeUrl = getNodeUrl(config.networkId, CHAIN_ID_ALEPHIUM)
  web3.setCurrentNodeProvider(alphNodeUrl)

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
  runAPI(app, rootLogger, config)
  runMetrics(app, rootLogger, config.metricsPort)
}

function runAPI(relayerApp: StandardRelayerApp<any>, logger: Logger, config: Config) {
  const app = new Koa()
  const router = new Router()

  router.get(`/metrics`, async (ctx, next) => {
    ctx.body = await relayerApp.metricsRegistry.metrics()
  });

  router.post(
    `/vaas/:emitterChain/:emitterAddress/:targetChain/:sequence`,
    reprocessVaaById(rootLogger, relayerApp, config)
  )

  app.use(async (ctx, next) => {
    ctx.set('Access-Control-Allow-Origin', '*')
    ctx.set('Access-Control-Allow-Methods', 'POST, GET')
    await next()
  })
  app.use(relayerApp.storageKoaUI("/ui"))

  app.use(router.routes())
  app.use(router.allowedMethods())

  const listenPort = config.apiPort ?? 31000
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

async function isTransferCompleted(emitterChain: ChainId, sequence: bigint, config: Config): Promise<boolean> {
  const tokenBridgeId = getTokenBridgeAddress(config.networkId, CHAIN_ID_ALEPHIUM)
  const groupIndex = getAlephiumGroupIndex(config.networkId)
  const tokenBridgeForChainId = getTokenBridgeForChainId(tokenBridgeId, emitterChain, groupIndex)
  return getIsTransferCompletedBySequenceAlph(tokenBridgeForChainId, groupIndex, sequence)
}

function reprocessVaaById(logger: Logger, relayer: StandardRelayerApp, config: Config) {
  return async (ctx: Context, _next: KoaNext) => {
    const { emitterChain, emitterAddress, targetChain, sequence } = ctx.params
    const vaaId = `${emitterChain}/${emitterAddress}/${targetChain}/${sequence}`.toLowerCase()
    try {
      if ((Number(targetChain) as ChainId) !== CHAIN_ID_ALEPHIUM) {
        ctx.body = { error: `invalid target chain id ${targetChain}` }
        return
      }

      let txId = await relayer.storage.getTxId(vaaId)
      if (txId) {
        logger.debug(`transfer is completed, tx id: ${txId}`)
        ctx.body = { txId: txId }
        return
      }

      const completed = await isTransferCompleted(Number(emitterChain) as ChainId, BigInt(sequence), config)
      if (completed) {
        logger.debug(`transfer is completed, but we don't know the tx id`)
        ctx.body = {}
        return
      }

      const hasJob = await relayer.hasJob(vaaId)
      if (!hasJob || !txId) {
        logger.info("fetching vaa requested by API")
        const vaa = await relayer.fetchVaa(emitterChain, emitterAddress, targetChain, sequence)
        if (!vaa) {
          const errorMessage = `failed to fetch vaa, vaa id: ${vaaId}`
          logger.error(errorMessage)
          ctx.body = { error: errorMessage }
          return
        }
        await relayer.retryProcessVaa(Buffer.from(vaa.bytes))
      }

      txId = await getTxId(relayer, vaaId)
      ctx.body = txId ? { txId: txId } : { error: `failed to get tx id, vaa id: ${vaaId}` }
    } catch (error) {
      const errorMessage = `failed to process vaa, error: ${error}, vaa id: ${vaaId}`
      logger.error(errorMessage)
      ctx.body = { error: errorMessage }
    }
  }
}

async function getTxId(
  relayer: StandardRelayerApp,
  vaaId: string,
  retries: number = 2,
  retryTimeout: number = 5
): Promise<string | null> {
  let result: string | null
  let attempts = 0
  while (!result && attempts < retries) {
    attempts++
    await new Promise((resolve) => setTimeout(resolve, retryTimeout * 1000))
    result = await relayer.storage.getTxId(vaaId)
  }
  return result
}

main()

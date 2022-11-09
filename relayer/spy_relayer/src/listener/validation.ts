import {
  CHAIN_ID_ALEPHIUM,
  hexToNativeString,
  deserializeVAA,
  uint8ArrayToHex,
  VAA,
  TransferToken,
  VAAPayload
} from "alephium-wormhole-sdk";
import { getListenerEnvironment } from "../configureEnv";
import { getLogger } from "../helpers/logHelper";
import {
  connectToRedis,
  getBackupQueue,
  getKey,
  RedisTables,
} from "../helpers/redisHelper";

const logger = getLogger();

export function validateInit(): boolean {
  const env = getListenerEnvironment();

  logger.info(`Supported target chains: [${env.spyServiceFilters.toString()}]`)
  if (env.spyServiceFilters.length) {
    env.spyServiceFilters.forEach((allowedContract) => {
      logger.info(
        "Adding allowed contract: chainId: [" +
          allowedContract.chainId +
          "] => address: [" +
          allowedContract.emitterAddress +
          "]"
      );
    });
  } else {
    logger.info("There are no white listed contracts provisioned.");
  }

  logger.info(`Supported tokens : [${env.supportedTokens.toString()}]`);
  if (env.supportedTokens.length) {
    env.supportedTokens.forEach((supportedToken) => {
      logger.info(
        "Adding allowed contract: chainId: [" +
          supportedToken.chainId +
          "] => address: [" +
          supportedToken.address +
          "]" +
          " key: " +
          getKey(supportedToken.chainId, supportedToken.address)
      );
    });
  } else {
    logger.info("There are no white listed contracts provisioned.");
  }

  return true;
}

export async function parseAndValidateVaa(
  rawVaa: Uint8Array
): Promise<string | VAA<TransferToken>> {
  logger.debug(`Validating signed VAA ${uint8ArrayToHex(rawVaa)}`);
  let vaa: VAA<VAAPayload> | null = null;
  try {
    vaa = deserializeVAA(rawVaa)
  } catch (e) {
    logger.error(`Encountered error while parsing raw VAA: ${e}`)
  }
  if (!vaa) {
    return "Unable to parse the specified VAA.";
  }
  const env = getListenerEnvironment();

  const emitterChainId = vaa.body.emitterChainId
  const emitterAddressHex = uint8ArrayToHex(vaa.body.emitterAddress)
  const nativeAddress = emitterChainId === CHAIN_ID_ALEPHIUM
    ? emitterAddressHex
    : hexToNativeString(emitterAddressHex, vaa.body.emitterChainId)
  const isApprovedAddress = env.spyServiceFilters.some((allowedContract) =>
    vaa &&
    nativeAddress &&
    allowedContract.chainId === emitterChainId &&
    allowedContract.emitterAddress.toLowerCase() === nativeAddress.toLowerCase()
  )
  if (!isApprovedAddress) {
    logger.debug("Specified vaa is not from an approved address.");
    return "VAA is not from a monitored contract.";
  }

  if (vaa.body.payload.type !== 'TransferToken') {
    logger.debug("Specified vaa is not transfer token type");
    return "Specified vaa is not transfer token type";
  }

  const transferTokenPayload = vaa.body.payload

  const originAddressNative = hexToNativeString(
    uint8ArrayToHex(transferTokenPayload.originAddress),
    transferTokenPayload.originChain
  );

  const approvedToken = env.supportedTokens.find((token) => {
    return (
      originAddressNative &&
      token.address.toLowerCase() === originAddressNative.toLowerCase() &&
      token.chainId === transferTokenPayload.originChain
    );
  });

  if (approvedToken === undefined) {
    logger.debug("Token transfer is not for an approved token.");
    return "Token transfer is not for an approved token.";
  }

  if (transferTokenPayload.fee < approvedToken.minimalFee) {
    const errorMessage = `Token transfer does not have a sufficient fee, tranfer fee: ${transferTokenPayload.fee}, minimal fee: ${approvedToken.minimalFee}`
    logger.debug(errorMessage)
    return errorMessage
  }

  const key = getKey(transferTokenPayload.originChain, originAddressNative as string); //was null checked above

  const isQueued = await checkQueue(key);
  if (isQueued) {
    return isQueued;
  }
  //TODO maybe an is redeemed check?

  return vaa as VAA<TransferToken>
}

async function checkQueue(key: string): Promise<string | null> {
  try {
    const backupQueue = getBackupQueue();
    const queuedRecord = backupQueue.find((record) => record[0] === key)

    if (queuedRecord) {
      logger.debug("VAA was already in the listener queue");
      return "VAA was already in the listener queue";
    }

    const rClient = await connectToRedis();
    if (!rClient) {
      logger.error("Failed to connect to redis");
      return null;
    }
    await rClient.select(RedisTables.INCOMING);
    const record1 = await rClient.get(key);

    if (record1) {
      logger.debug("VAA was already in INCOMING table");
      rClient.quit();
      return "VAA was already in INCOMING table";
    }

    await rClient.select(RedisTables.WORKING);
    const record2 = await rClient.get(key);
    if (record2) {
      logger.debug("VAA was already in WORKING table");
      rClient.quit();
      return "VAA was already in WORKING table";
    }
    rClient.quit();
  } catch (e) {
    logger.error("Failed to connect to redis");
  }

  return null;
}

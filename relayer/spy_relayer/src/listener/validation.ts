import {
  ChainId,
  CHAIN_ID_ALEPHIUM,
  hexToNativeString,
  parseTransferPayload,
  parseVAA,
  uint8ArrayToHex
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
): Promise<string | ParsedVaa<ParsedTransferPayload>> {
  logger.debug(`Validating signed VAA ${uint8ArrayToHex(rawVaa)}`);
  let parsedVaa: ParsedVaa<Uint8Array> | null = null;
  try {
    parsedVaa = parseVaaTyped(rawVaa);
  } catch (e) {
    logger.error(`Encountered error while parsing raw VAA: ${e}`);
  }
  if (!parsedVaa) {
    return "Unable to parse the specified VAA.";
  }
  const env = getListenerEnvironment();

  const nativeAddress = parsedVaa.emitterChain === CHAIN_ID_ALEPHIUM
    ? uint8ArrayToHex(parsedVaa.emitterAddress)
    : hexToNativeString(uint8ArrayToHex(parsedVaa.emitterAddress), parsedVaa.emitterChain)
  const isApprovedAddress = env.spyServiceFilters.some((allowedContract) =>
    parsedVaa &&
    nativeAddress &&
    allowedContract.chainId === parsedVaa.emitterChain &&
    allowedContract.emitterAddress.toLowerCase() === nativeAddress.toLowerCase()
  )
  if (!isApprovedAddress) {
    logger.debug("Specified vaa is not from an approved address.");
    return "VAA is not from a monitored contract.";
  }

  const isCorrectPayloadType = parsedVaa.payload[0] === 1;
  if (!isCorrectPayloadType) {
    logger.debug("Specified vaa is not payload type 1.");
    return "Specified vaa is not payload type 1..";
  }

  let parsedPayload: any = null;
  try {
    parsedPayload = parseTransferPayload(Buffer.from(parsedVaa.payload));
  } catch (e) {
    logger.error(`Encountered error while parsing vaa payload: ${e}`);
  }

  if (!parsedPayload) {
    logger.debug("Failed to parse the transfer payload.");
    return "Could not parse the transfer payload.";
  }

  const originAddressNative = hexToNativeString(
    parsedPayload.originAddress,
    parsedPayload.originChain
  );

  const approvedToken = env.supportedTokens.find((token) => {
    return (
      originAddressNative &&
      token.address.toLowerCase() === originAddressNative.toLowerCase() &&
      token.chainId === parsedPayload.originChain
    );
  });

  if (approvedToken === undefined) {
    logger.debug("Token transfer is not for an approved token.");
    return "Token transfer is not for an approved token.";
  }

  if (parsedPayload.fee < approvedToken.minimalFee) {
    const errorMessage = `Token transfer does not have a sufficient fee, tranfer fee: ${parsedPayload.fee}, minimal fee: ${approvedToken.minimalFee}`
    logger.debug(errorMessage)
    return errorMessage
  }

  const key = getKey(parsedPayload.originChain, originAddressNative as string); //was null checked above

  const isQueued = await checkQueue(key);
  if (isQueued) {
    return isQueued;
  }
  //TODO maybe an is redeemed check?

  const fullyTyped = { ...parsedVaa, payload: parsedPayload };
  return fullyTyped;
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

//TODO move these to the official SDK
export function parseVaaTyped(signedVAA: Uint8Array) {
  const parsedVAA = parseVAA(signedVAA);
  return {
    timestamp: parsedVAA.body.timestamp,
    nonce: parsedVAA.body.nonce,
    emitterChain: parsedVAA.body.emitterChainId,
    emitterAddress: parsedVAA.body.emitterAddress,
    targetChain: parsedVAA.body.targetChainId,
    sequence: parsedVAA.body.sequence,
    consistencyLevel: parsedVAA.body.consistencyLevel,
    payload: parsedVAA.body.payload,
  }
}

export type ParsedVaa<T> = {
  timestamp: number;
  nonce: number;
  emitterChain: ChainId;
  emitterAddress: Uint8Array;
  targetChain: ChainId,
  sequence: number;
  consistencyLevel: number;
  payload: T;
};

export type ParsedTransferPayload = {
  amount: BigInt
  originAddress: string
  originChain: ChainId
  targetAddress: string
  fee: BigInt
}

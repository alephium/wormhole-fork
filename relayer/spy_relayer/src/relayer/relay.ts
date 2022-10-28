import {
  CHAIN_ID_ALEPHIUM,
  CHAIN_ID_SOLANA,
  CHAIN_ID_TERRA,
  hexToNativeString,
  hexToUint8Array,
  isEVMChain,
  parseTransferPayload,
  parseVAA,
} from "alephium-wormhole-sdk";

import { relayEVM } from "./evm";
import { relaySolana } from "./solana";
import { relayTerra } from "./terra";
import {
  getChainConfigInfo,
  AlephiumChainConfigInfo,
  EthereumChainConfigInfo,
  SolanaChainConfigInfo,
  TerraChainConfigInfo
} from "../configureEnv";
import { RelayResult, Status } from "../helpers/redisHelper";
import { getScopedLogger, ScopedLogger } from "../helpers/logHelper";
import { PromHelper } from "../helpers/promHelpers";
import { relayAlph } from "./alph";

export async function relay(
  signedVAA: string,
  checkOnly: boolean,
  walletPrivateKey: any,
  relayLogger: ScopedLogger,
  metrics: PromHelper
): Promise<RelayResult> {
  const logger = getScopedLogger(["relay"], relayLogger);
  const parsedVAA = parseVAA(hexToUint8Array(signedVAA));
  if (parsedVAA.body.payload[0] === 1) {
    const transferPayload = parseTransferPayload(
      Buffer.from(parsedVAA.body.payload)
    );

    const targetChainId = parsedVAA.body.targetChainId
    const chainConfigInfo = getChainConfigInfo(targetChainId);
    if (!chainConfigInfo) {
      const errorMessage = `Fatal Error: target chain ${targetChainId} not supported`
      logger.error(errorMessage);
      return {
        status: Status.FatalError,
        result: errorMessage,
      };
    }

    logger.debug(`Relay transfer payload: ${JSON.stringify(transferPayload)}`)

    if (isEVMChain(targetChainId)) {
      const evmConfigInfo = chainConfigInfo as EthereumChainConfigInfo
      const unwrapNative =
        transferPayload.originChain === targetChainId &&
        hexToNativeString(
          transferPayload.originAddress,
          transferPayload.originChain
        )?.toLowerCase() === evmConfigInfo.wrappedNativeAsset.toLowerCase();
      let evmResult = await relayEVM(
        evmConfigInfo,
        signedVAA,
        unwrapNative,
        checkOnly,
        walletPrivateKey,
        logger,
        metrics
      );
      return {
        status: evmResult.redeemed ? Status.Completed : Status.Error,
        result: evmResult.result.toString(),
      };
    }

    if (targetChainId === CHAIN_ID_SOLANA) {
      const solanaConfigInfo = chainConfigInfo as SolanaChainConfigInfo
      let rResult: RelayResult = { status: Status.Error, result: "" };
      const retVal = await relaySolana(
        solanaConfigInfo,
        signedVAA,
        checkOnly,
        walletPrivateKey,
        logger,
        metrics
      );
      if (retVal.redeemed) {
        rResult.status = Status.Completed;
      }
      rResult.result = retVal.result;
      return rResult;
    }

    if (targetChainId === CHAIN_ID_TERRA) {
      const terraConfigInfo = chainConfigInfo as TerraChainConfigInfo
      let rResult: RelayResult = { status: Status.Error, result: "" };
      const retVal = await relayTerra(
        terraConfigInfo,
        signedVAA,
        checkOnly,
        walletPrivateKey,
        logger,
        metrics
      );
      if (retVal.redeemed) {
        rResult.status = Status.Completed;
      }
      rResult.result = retVal.result;
      return rResult;
    }

    if (targetChainId === CHAIN_ID_ALEPHIUM) {
      const alphConfigInfo = chainConfigInfo as AlephiumChainConfigInfo
      const redeemResult = await relayAlph(
        parsedVAA.body.emitterChainId,
        alphConfigInfo,
        signedVAA,
        checkOnly,
        walletPrivateKey,
        logger,
        metrics
      )
      return redeemResult.redeemed
        ? { status: Status.Completed, result: redeemResult.result }
        : { status: Status.Error, result: redeemResult.result }
    }

    const errorMessage = `Fatal Error: target chain ${targetChainId} is invalid, this is a program bug!`
    logger.error(errorMessage)

    return {
      status: Status.FatalError,
      result: `Fatal Error: target chain ${targetChainId} is invalid, this is a program bug!`
    };
  }
  return { status: Status.FatalError, result: "ERROR: Invalid payload type" };
}

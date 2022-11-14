import { getRelayerEnvironment, validateChainConfig, WalletMonitorEnvironment } from "../configureEnv";
import { getLogger } from "../helpers/logHelper";
import { PromHelper } from "../helpers/promHelpers";
import { collectWallets } from "./walletMonitor";

let metrics: PromHelper;

const logger = getLogger();
let walletMonitorEnv: WalletMonitorEnvironment;

export function init(): boolean {
  try {
    walletMonitorEnv = getRelayerEnvironment();
  } catch (e) {
    logger.error(
      "Encountered error while initiating the monitor environment: " + e
    );
    return false;
  }

  return true;
}

export async function run(ph: PromHelper) {
  metrics = ph;
  await validateChainConfig(walletMonitorEnv)

  try {
    collectWallets(metrics);
  } catch (e) {
    logger.error("Failed to kick off collectWallets: " + e);
  }
}

import {
  getIsTransferCompletedAlph,
  hexToUint8Array,
  redeemOnAlph
} from "alephium-wormhole-sdk";
import { PrivateKeyWallet } from "@alephium/web3-wallet"
import { AlephiumChainConfigInfo } from "../configureEnv";
import { getScopedLogger, ScopedLogger } from "../helpers/logHelper";
import { PromHelper } from "../helpers/promHelpers";

export async function relayAlph(
  chainConfigInfo: AlephiumChainConfigInfo,
  signedVAA: string,
  checkOnly: boolean,
  mnemonic: string,
  relayLogger: ScopedLogger,
  metrics: PromHelper
) {
  const logger = getScopedLogger(
    ["alph", chainConfigInfo.chainName],
    relayLogger
  )

  // we have validated the `groupIndex` at initialization
  const groupIndex = chainConfigInfo.groupIndex!
  const signer = PrivateKeyWallet.FromMnemonicWithGroup(mnemonic, groupIndex)
  const signedVaaArray = hexToUint8Array(signedVAA)

  logger.debug('Checking to see if vaa has already been redeemed.')
  const alreadyRedeemed = await getIsTransferCompletedAlph(
    signer.nodeProvider,
    chainConfigInfo.tokenBridgeAddress,
    groupIndex,
    signedVaaArray
  )

  if (alreadyRedeemed) {
    logger.info('VAA has already been redeemed!')
    return { redeemed: true, result: 'already redeemed' }
  }
  if (checkOnly) {
    return { redeemed: false, result: 'not redeemed' }
  }

  logger.info(`Will redeem using pubkey: ${(await signer.getSelectedAccount()).address}`)

  logger.debug('Redeeming...')
  const result = await redeemOnAlph(signer, chainConfigInfo.tokenBridgeAddress, signedVaaArray)
  logger.info(`Redeem transaction tx id: ${result.txId}`)

  metrics.incSuccesses(chainConfigInfo.chainId)
  return { redeemed: true, result: result.txId }
}

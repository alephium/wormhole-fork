import { ethers } from "ethers";
import { NFTBridge__factory } from "../ethers-contracts";
import { getSignedVAAHash } from "../bridge";
import { Connection } from "@solana/web3.js";
import { LCDClient } from "@terra-money/terra.js";
import axios from "axios";
import { redeemOnTerra } from ".";
import { TERRA_REDEEMED_CHECK_WALLET_ADDRESS, deserializeVAA } from "..";
import { getClaim } from "../solana/wormhole";

export async function getIsTransferCompletedEth(
  nftBridgeAddress: string,
  provider: ethers.Signer | ethers.providers.Provider,
  signedVAA: Uint8Array
) {
  const nftBridge = NFTBridge__factory.connect(nftBridgeAddress, provider);
  const signedVAAHash = getSignedVAAHash(signedVAA);
  return await nftBridge.isTransferCompleted(signedVAAHash);
}

export async function getIsTransferCompletedTerra(
  nftBridgeAddress: string,
  signedVAA: Uint8Array,
  client: LCDClient,
  gasPriceUrl: string
) {
  const msg = await redeemOnTerra(
    nftBridgeAddress,
    TERRA_REDEEMED_CHECK_WALLET_ADDRESS,
    signedVAA
  );
  // TODO: remove gasPriceUrl and just use the client's gas prices
  const gasPrices = await axios.get(gasPriceUrl).then((result) => result.data);
  const account = await client.auth.accountInfo(
    TERRA_REDEEMED_CHECK_WALLET_ADDRESS
  );
  try {
    await client.tx.estimateFee(
      [
        {
          sequenceNumber: account.getSequenceNumber(),
          publicKey: account.getPublicKey(),
        },
      ],
      {
        msgs: [msg],
        memo: "already redeemed calculation",
        feeDenoms: ["uluna"],
        gasPrices,
      }
    );
  } catch (e: any) {
    // redeemed if the VAA was already executed
    return e.response.data.message.includes("VaaAlreadyExecuted");
  }
  return false;
}

export async function getIsTransferCompletedSolana(
  nftBridgeAddress: string,
  signedVAA: Uint8Array,
  connection: Connection
) {
  const parsed = deserializeVAA(signedVAA);
  return getClaim(
    connection,
    nftBridgeAddress,
    parsed.body.emitterAddress,
    parsed.body.emitterChainId,
    parsed.body.sequence
  ).catch((e) => false);
}

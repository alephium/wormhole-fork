import { ethers } from "ethers";
import { Bridge__factory } from "../ethers-contracts";
import { getSignedVAAHash } from "../bridge";
import { LCDClient } from "@terra-money/terra.js";
import axios from "axios";
import { redeemOnTerra } from ".";
import { TERRA_REDEEMED_CHECK_WALLET_ADDRESS } from "..";
import { toAlphContractAddress, VAA } from "../utils";
import { NodeProvider } from "alephium-web3";
import { node } from "alephium-web3";

const bigInt512 = BigInt(512)
const bigInt256 = BigInt(256)
const bigInt1 = BigInt(1)

export async function getIsTransferCompletedAlph(
  provider: NodeProvider,
  tokenBridgeForChainId: string,
  groupIndex: number,
  signedVAA: Uint8Array
) {
  const tokenBridgeForChainAddress = toAlphContractAddress(tokenBridgeForChainId)
  const contractState = await provider.contracts.getContractsAddressState(tokenBridgeForChainAddress, {group: groupIndex})
  const fields = contractState.fields
  const next = BigInt((fields[5] as node.ValU256).value)
  const next1 = BigInt((fields[6] as node.ValU256).value)
  const next2 = BigInt((fields[7] as node.ValU256).value)
  const sequence = BigInt(VAA.from(signedVAA).body.sequence)

  if (sequence < next) {
    // TODO: check undone sequence list
    return true
  }

  let distance = sequence - next
  if (distance >= bigInt512) {
    return false
  }
  if (distance < bigInt256) {
    return ((next1 >> distance) & bigInt1) === bigInt1
  }

  distance = distance - bigInt256
  return ((next2 >> distance) & bigInt1) === bigInt1
}

export async function getIsTransferCompletedEth(
  tokenBridgeAddress: string,
  provider: ethers.Signer | ethers.providers.Provider,
  signedVAA: Uint8Array
) {
  const tokenBridge = Bridge__factory.connect(tokenBridgeAddress, provider);
  const signedVAAHash = await getSignedVAAHash(signedVAA);
  return await tokenBridge.isTransferCompleted(signedVAAHash);
}

export async function getIsTransferCompletedTerra(
  tokenBridgeAddress: string,
  signedVAA: Uint8Array,
  client: LCDClient,
  gasPriceUrl: string
) {
  const msg = await redeemOnTerra(
    tokenBridgeAddress,
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

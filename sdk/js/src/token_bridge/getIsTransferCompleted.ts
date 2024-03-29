import { Connection, PublicKey } from "@solana/web3.js";
import { LCDClient } from "@terra-money/terra.js";
import { Algodv2, bigIntToBytes } from "algosdk";
import axios from "axios";
import { ethers } from "ethers";
import { redeemOnTerra } from ".";
import { TERRA_REDEEMED_CHECK_WALLET_ADDRESS } from "..";
import { extractSequenceFromVAA } from "../utils";
import { addressFromContractId, subContractId } from "@alephium/web3";
import {
  BITS_PER_KEY,
  calcLogicSigAccount,
  MAX_BITS,
  _parseVAAAlgorand,
} from "../algorand";
import { getSignedVAAHash } from "../bridge";
import { Bridge__factory } from "../ethers-contracts";
import { importCoreWasm } from "../solana/wasm";
import { safeBigIntToNumber } from "../utils/bigint";
import { zeroPad } from "./alephium";
import { TokenBridgeForChain } from "../alephium-contracts/ts/TokenBridgeForChain";
import { UnexecutedSequence } from "../alephium-contracts/ts/UnexecutedSequence";

const bigInt512 = BigInt(512)
const bigInt256 = BigInt(256)
const bigInt1 = BigInt(1)

export async function isSequenceExecuted(
  tokenBridgeForChainId: string,
  sequence: bigint,
  groupIndex: number
): Promise<boolean> {
  const path = zeroPad(Math.floor(Number(sequence) / 256).toString(16), 8)
  const contractId = subContractId(tokenBridgeForChainId, path, groupIndex)
  const contractAddress = addressFromContractId(contractId)
  try {
    const contract = UnexecutedSequence.at(contractAddress)
    const contractState = await contract.fetchState()
    const distance = sequence - contractState.fields.begin
    return ((contractState.fields.sequences >> distance) & bigInt1) === bigInt1
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('KeyNotFound')) {
      // the unexecuted contract has been destroyed
      return true
    }
    throw error
  }
}

export async function getIsTransferCompletedAlph(
  tokenBridgeForChainId: string,
  groupIndex: number,
  signedVAA: Uint8Array
) {
  return getIsTransferCompletedBySequenceAlph(
    tokenBridgeForChainId,
    groupIndex,
    extractSequenceFromVAA(signedVAA)
  )
}

export async function getIsTransferCompletedBySequenceAlph(
  tokenBridgeForChainId: string,
  groupIndex: number,
  sequence: bigint
) {
  const tokenBridgeForChainAddress = addressFromContractId(tokenBridgeForChainId)
  const contract = TokenBridgeForChain.at(tokenBridgeForChainAddress)
  const contractState = await contract.fetchState()

  if (sequence < contractState.fields.start) {
    return isSequenceExecuted(tokenBridgeForChainId, sequence, groupIndex)
  }

  let distance = sequence - contractState.fields.start
  if (distance >= bigInt512) {
    return false
  }
  if (distance < bigInt256) {
    return ((contractState.fields.firstNext256 >> distance) & bigInt1) === bigInt1
  }

  distance = distance - bigInt256
  return ((contractState.fields.secondNext256 >> distance) & bigInt1) === bigInt1
}

export async function getIsTransferCompletedEth(
  tokenBridgeAddress: string,
  provider: ethers.Signer | ethers.providers.Provider,
  signedVAA: Uint8Array
): Promise<boolean> {
  const tokenBridge = Bridge__factory.connect(tokenBridgeAddress, provider);
  const signedVAAHash = getSignedVAAHash(signedVAA);
  return await tokenBridge.isTransferCompleted(signedVAAHash);
}

export async function getIsTransferCompletedTerra(
  tokenBridgeAddress: string,
  signedVAA: Uint8Array,
  client: LCDClient,
  gasPriceUrl: string
): Promise<boolean> {
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

export async function getIsTransferCompletedSolana(
  tokenBridgeAddress: string,
  signedVAA: Uint8Array,
  connection: Connection
): Promise<boolean> {
  const { claim_address } = await importCoreWasm();
  const claimAddress = await claim_address(tokenBridgeAddress, signedVAA);
  const claimInfo = await connection.getAccountInfo(
    new PublicKey(claimAddress),
    "confirmed"
  );
  return !!claimInfo;
}

// Algorand

/**
 * This function is used to check if a VAA has been redeemed by looking at a specific bit.
 * @param client AlgodV2 client
 * @param appId Application Id
 * @param addr Wallet address. Someone has to pay for this.
 * @param seq The sequence number of the redemption
 * @returns true, if the bit was set and VAA was redeemed, false otherwise.
 */
async function checkBitsSet(
  client: Algodv2,
  appId: bigint,
  addr: string,
  seq: bigint
): Promise<boolean> {
  let retval: boolean = false;
  let appState: any[] = [];
  const acctInfo = await client.accountInformation(addr).do();
  const als = acctInfo["apps-local-state"];
  als.forEach((app: any) => {
    if (BigInt(app["id"]) === appId) {
      appState = app["key-value"];
    }
  });
  if (appState.length === 0) {
    return retval;
  }

  const BIG_MAX_BITS: bigint = BigInt(MAX_BITS);
  const BIG_EIGHT: bigint = BigInt(8);
  // Start on a MAX_BITS boundary
  const start: bigint = (seq / BIG_MAX_BITS) * BIG_MAX_BITS;
  // beg should be in the range [0..MAX_BITS]
  const beg: number = safeBigIntToNumber(seq - start);
  // s should be in the range [0..15]
  const s: number = Math.floor(beg / BITS_PER_KEY);
  const b: number = Math.floor((beg - s * BITS_PER_KEY) / 8);

  const key = Buffer.from(bigIntToBytes(s, 1)).toString("base64");
  appState.forEach((kv) => {
    if (kv["key"] === key) {
      const v = Buffer.from(kv["value"]["bytes"], "base64");
      const bt = 1 << safeBigIntToNumber(seq % BIG_EIGHT);
      retval = (v[b] & bt) != 0;
      return;
    }
  });
  return retval;
}

/**
 * <p>Returns true if this transfer was completed on Algorand</p>
 * @param client AlgodV2 client
 * @param appId Most likely the Token bridge ID
 * @param signedVAA VAA to check
 * @param wallet The account paying the bill for this (it isn't free)
 * @returns true if VAA has been redeemed, false otherwise
 */
export async function getIsTransferCompletedAlgorand(
  client: Algodv2,
  appId: bigint,
  signedVAA: Uint8Array
): Promise<boolean> {
  const parsedVAA = _parseVAAAlgorand(signedVAA);
  const seq: bigint = parsedVAA.sequence;
  const chainRaw: string = parsedVAA.chainRaw; // this needs to be a hex string
  const em: string = parsedVAA.emitter; // this needs to be a hex string
  const { doesExist, lsa } = await calcLogicSigAccount(
    client,
    appId,
    seq / BigInt(MAX_BITS),
    chainRaw + em
  );
  if (!doesExist) {
    return false;
  }
  const seqAddr = lsa.address();
  const retVal: boolean = await checkBitsSet(client, appId, seqAddr, seq);
  return retVal;
}

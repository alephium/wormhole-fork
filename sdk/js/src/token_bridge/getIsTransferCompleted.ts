import { ethers } from "ethers";
import { extractSequenceFromVAA } from "../utils";
import { addressFromContractId, subContractId } from "@alephium/web3";
import { getSignedVAAHash } from "../bridge";
import { Bridge__factory } from "../ethers-contracts";
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

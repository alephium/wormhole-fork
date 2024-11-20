import { BigNumber, ContractReceipt } from "ethers";
import { Implementation__factory } from "../ethers-contracts";
import { node } from "@alephium/web3";
import { ChainId } from "../utils";

function checkAlphLog(event: node.ContractEventByTxId) {
  if (event.fields.length !== 6) {
      throw Error("invalid event, wormhole message has 6 fields")
  }
}

export function parseSequenceFromLogAlph(event: node.ContractEventByTxId): string {
  checkAlphLog(event)
  const field = event.fields[2]
  if (field.type !== 'U256') {
      throw Error("invalid event, expect U256 type, have: " + field.type)
  }
  return (field as node.ValU256).value
}

export function parseTargetChainFromLogAlph(event: node.ContractEventByTxId): ChainId {
  checkAlphLog(event)
  const field = event.fields[1]
  if (field.type !== 'U256') {
      throw Error("invalid event, expect U256 type, have: " + field.type)
  }
  return parseInt((field as node.ValU256).value) as ChainId
}

export function parseSequenceFromLogEth(
  receipt: ContractReceipt,
  bridgeAddress: string
): string {
  // TODO: dangerous!(?)
  const bridgeLog = receipt.logs.filter((l) => {
    return l.address === bridgeAddress;
  })[0];
  const {
    args: { sequence },
  } = Implementation__factory.createInterface().parseLog(bridgeLog);
  return sequence.toString();
}

export function parseTargetChainFromLogEth(
  receipt: ContractReceipt,
  bridgeAddress: string
): ChainId {
  const bridgeLog = receipt.logs.filter((l) => {
    return l.address === bridgeAddress;
  })[0];
  const {
    args: { targetChainId },
  } = Implementation__factory.createInterface().parseLog(bridgeLog);
  return parseInt(targetChainId.toString()) as ChainId;
}

export function parseSequencesFromLogEth(
  receipt: ContractReceipt,
  bridgeAddress: string
): string[] {
  // TODO: dangerous!(?)
  const bridgeLogs = receipt.logs.filter((l) => {
    return l.address === bridgeAddress;
  });
  return bridgeLogs.map((bridgeLog) => {
    const {
      args: { sequence },
    } = Implementation__factory.createInterface().parseLog(bridgeLog);
    return sequence.toString();
  });
}

export function parseSequenceFromLogAlgorand(
  result: Record<string, any>
): string {
  let sequence = "";
  if (result["inner-txns"]) {
    const innerTxns: [] = result["inner-txns"];
    class iTxn {
      "local-state-delta": [[Object]];
      logs: Buffer[] | undefined;
      "pool-eror": string;
      txn: { txn: [Object] } | undefined;
    }
    innerTxns.forEach((txn: iTxn) => {
      if (txn.logs) {
        sequence = BigNumber.from(txn.logs[0].slice(0, 8)).toString();
      }
    });
  }
  return sequence;
}

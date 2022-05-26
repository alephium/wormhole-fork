import { TransactionResponse } from "@solana/web3.js";
import { TxInfo } from "@terra-money/terra.js";
import { ContractReceipt } from "ethers";
import { Implementation__factory } from "../ethers-contracts";
import { node } from "alephium-web3";

export function parseSequenceFromLogAlph(event: node.ContractEventByTxId): string {
  if (event.fields && event.fields.length !== 5) {
      throw Error("invalid event, wormhole message has 5 fields")
  }
  const field = event.fields[1]
  if (field.type !== 'U256') {
      throw Error("invalid event, expect U256 type, have: " + field.type)
  }
  return (field as node.ValU256).value
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

export function parseSequenceFromLogTerra(info: TxInfo): string {
  // Scan for the Sequence attribute in all the outputs of the transaction.
  // TODO: Make this not horrible.
  let sequence = "";
  const jsonLog = JSON.parse(info.raw_log);
  jsonLog.map((row: any) => {
    row.events.map((event: any) => {
      event.attributes.map((attribute: any) => {
        if (attribute.key === "message.sequence") {
          sequence = attribute.value;
        }
      });
    });
  });
  console.log("Terra Sequence: ", sequence);
  return sequence.toString();
}

export function parseSequencesFromLogTerra(info: TxInfo): string[] {
  // Scan for the Sequence attribute in all the outputs of the transaction.
  // TODO: Make this not horrible.
  const sequences: string[] = [];
  const jsonLog = JSON.parse(info.raw_log);
  jsonLog.map((row: any) => {
    row.events.map((event: any) => {
      event.attributes.map((attribute: any) => {
        if (attribute.key === "message.sequence") {
          sequences.push(attribute.value.toString());
        }
      });
    });
  });
  return sequences;
}

const SOLANA_SEQ_LOG = "Program log: Sequence: ";
export function parseSequenceFromLogSolana(info: TransactionResponse) {
  // TODO: better parsing, safer
  const sequence = info.meta?.logMessages
    ?.filter((msg) => msg.startsWith(SOLANA_SEQ_LOG))?.[0]
    ?.replace(SOLANA_SEQ_LOG, "");
  if (!sequence) {
    throw new Error("sequence not found");
  }
  return sequence.toString();
}

export function parseSequencesFromLogSolana(info: TransactionResponse) {
  // TODO: better parsing, safer
  return info.meta?.logMessages
    ?.filter((msg) => msg.startsWith(SOLANA_SEQ_LOG))
    .map((msg) => msg.replace(SOLANA_SEQ_LOG, ""));
}

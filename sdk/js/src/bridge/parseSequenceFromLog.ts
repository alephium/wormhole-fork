import { TxInfo } from "@terra-money/terra.js";
import { ContractReceipt } from "ethers";
import { Implementation__factory } from "../ethers-contracts";
import { ValByteVec, ValU256 } from 'alephium-web3/api/api-alephium'
import { CliqueClient } from 'alephium-web3'

export async function parseSequenceFromLogAlph(client: CliqueClient, txId: string, bridgeId: string): Promise<string> {
  const events = await client.events.getEventsTxScript({txId: txId})
  const event = events.data.events.find(event => event.txId === txId)
  if (typeof event === 'undefined') {
      return Promise.reject("failed to get event for tx: " + txId)
  }
  if (event.eventIndex !== 0) {
      return Promise.reject("invalid event index: " + event.eventIndex)
  }
  if (event.fields && event.fields.length !== 5) {
      return Promise.reject("invalid event, wormhole message has 5 fields")
  }
  const sender = event.fields[0]
  if (sender.type !== 'ByteVec') {
      return Promise.reject("invalid sender, expect ByteVec type, have: " + sender.type)
  }
  const senderContractId = (sender as ValByteVec).value
  if (senderContractId !== bridgeId) {
      return Promise.reject("invalid sender, expect token bridge contract id, have: " + senderContractId)
  }
  const field = event.fields[1]
  if (field.type !== 'U256') {
      return Promise.reject("invalid event, expect U256 type, have: " + field.type)
  }
  return (field as ValU256).value
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

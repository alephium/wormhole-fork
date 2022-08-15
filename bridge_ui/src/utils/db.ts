// db.ts
import { ChainId } from '@certusone/wormhole-sdk';
import Dexie, { Table } from 'dexie';

export type TxStatus = "Completed" | "Confirmed" | "Pending"

export interface Transaction {
  txId: string
  sourceChainId: ChainId
  targetChainId: ChainId
  status: TxStatus
}

export function toConfirmedTx(tx: Transaction): Transaction {
  return {
    txId: tx.txId,
    sourceChainId: tx.sourceChainId,
    targetChainId: tx.targetChainId,
    status: "Confirmed"
  }
}

export class TransactionDB extends Dexie {
  txs!: Table<Transaction>; 

  constructor() {
    super('transaction database');
    this.version(1).stores({
      txs: '&txId, sourceChainId, targetChainId, sequence, status'
    });
  }
}

export const transactionDB = new TransactionDB();

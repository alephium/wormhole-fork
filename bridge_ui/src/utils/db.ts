import { ChainId } from '@certusone/wormhole-sdk';
import Dexie, { Table } from 'dexie';

export const TxDBName = 'tx-db'
export type TxStatus = "Completed" | "Confirmed" | "Pending"

export class Transaction {
  txId: string
  fromAddress: string
  sourceChainId: ChainId
  targetChainId: ChainId
  sequence: string
  status: TxStatus

  constructor(txId: string, fromAddress: string, sourceChainId: ChainId, targetChainId: ChainId, sequence: string, status: TxStatus) {
    this.txId = txId
    this.fromAddress = fromAddress
    this.sourceChainId = sourceChainId
    this.targetChainId = targetChainId
    this.sequence = sequence
    this.status = status
  }
}

export class TransactionDB extends Dexie {
  txs!: Table<Transaction>; 

  constructor() {
    super('tx-db');
    this.version(1).stores({
      txs: '&txId, fromAddress, sourceChainId, targetChainId, sequence, status'
    });
  }
}

export const transactionDB = new TransactionDB();

import { ChainId } from '@h0ngcha0/wormhole-sdk';
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
  private static dbName = 'tx-db'
  private static instance: TransactionDB | undefined = undefined

  txs!: Table<Transaction>

  static async exists(): Promise<boolean> {
    return Dexie.exists(TransactionDB.dbName)
  }

  static async delete(): Promise<void> {
    await Dexie.delete(TransactionDB.dbName)
    TransactionDB.instance = undefined
  }

  static getInstance(): TransactionDB {
    if (typeof TransactionDB.instance === 'undefined') {
      TransactionDB.instance = new TransactionDB()
    }
    return TransactionDB.instance
  }

  private constructor() {
    super('tx-db');
    this.version(1).stores({
      txs: '&txId, fromAddress, sourceChainId, targetChainId, sequence, status'
    });
  }
}

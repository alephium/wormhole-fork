package transactions

import (
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
)

type BridgeTransaction struct {
	vaaId      *vaa.VAAID
	txId       string
	address    string
	eventIndex uint32
}

func (t *BridgeTransaction) toDoc(blockNumber uint32, blockHash string, timestamp *time.Time) *TransactionUpdate {
	return &TransactionUpdate{
		ID:           t.vaaId.ToString(),
		TxId:         t.txId,
		Address:      t.address,
		BlockHash:    blockHash,
		BlockNumber:  blockNumber,
		EventIndex:   t.eventIndex,
		Sequence:     t.vaaId.Sequence,
		EmitterChain: t.vaaId.EmitterChain,
		TargetChain:  t.vaaId.TargetChain,
		Timestamp:    timestamp,
	}
}

type BlockTransactions struct {
	chainId        vaa.ChainID
	blockNumber    uint32
	blockHash      string
	blockTimestamp *time.Time
	txs            []*BridgeTransaction
}

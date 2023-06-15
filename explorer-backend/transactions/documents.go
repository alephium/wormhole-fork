package transactions

import (
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
)

type TransactionUpdate struct {
	ID           string      `bson:"_id"`
	TxId         string      `bson:"txId"`
	Address      string      `bson:"address"`
	BlockHash    string      `bson:"blockHash"`
	BlockNumber  uint32      `bson:"blockNumber"`
	EventIndex   uint32      `bson:"eventIndex"`
	Sequence     uint64      `bson:"sequence"`
	EmitterChain vaa.ChainID `bson:"emitterChain"`
	TargetChain  vaa.ChainID `bson:"targetChain"`
	Timestamp    *time.Time  `bson:"timestamp"`
}

package transactions

import (
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
)

type TransactionDoc struct {
	ID           string      `bson:"_id" json:"id"`
	TxId         string      `bson:"txId" json:"txId"`
	Address      string      `bson:"address" json:"address"`
	BlockHash    string      `bson:"blockHash" json:"blockHash"`
	BlockNumber  uint32      `bson:"blockNumber" json:"blockNumber"`
	Sequence     uint64      `bson:"sequence" json:"sequence"`
	EmitterChain vaa.ChainID `bson:"emitterChain" json:"emitterChain"`
	TargetChain  vaa.ChainID `bson:"targetChain" json:"targetChain"`
}

type TransactionDocWithVAA struct {
	TransactionDoc
	Vaa string `json:"vaa"`
}

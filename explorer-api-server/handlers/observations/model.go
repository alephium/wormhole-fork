// Package observations handle the request of observations data from governor endpoint defined in the api.
package observations

import (
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
)

// ObservationDoc represent an observation document.
type ObservationDoc struct {
	ID           string      `bson:"_id" json:"id"`
	Version      uint8       `bson:"version" json:"version"`
	EmitterChain vaa.ChainID `bson:"emitterChain" json:"emitterChain"`
	EmitterAddr  string      `bson:"emitterAddr" json:"emitterAddr"`
	TargetChain  vaa.ChainID `bson:"targetChain" json:"targetChain"`
	Sequence     uint64      `bson:"sequence" json:"sequence"`
	Hash         []byte      `bson:"hash" json:"hash"`
	TxHash       []byte      `bson:"txHash" json:"txHash"`
	GuardianAddr string      `bson:"guardianAddr" json:"guardianAddr"`
	Signature    []byte      `bson:"signature" json:"signature"`
	UpdatedAt    *time.Time  `bson:"updatedAt" json:"updatedAt"`
	IndexedAt    *time.Time  `bson:"indexedAt" json:"indexedAt"`
}

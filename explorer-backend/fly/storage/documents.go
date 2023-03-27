package storage

import (
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
)

type IndexingTimestamps struct {
	IndexedAt time.Time `bson:"indexedAt"`
}

type VaaUpdate struct {
	ID               string      `bson:"_id"`
	Version          uint8       `bson:"version"`
	EmitterChain     vaa.ChainID `bson:"emitterChain"`
	EmitterAddr      string      `bson:"emitterAddr"`
	TargetChain      vaa.ChainID `bson:"targetChain"`
	Sequence         uint64      `bson:"sequence"`
	GuardianSetIndex uint32      `bson:"guardianSetIndex"`
	TxId             []byte      `bson:"txId,omitempty"`
	Vaa              []byte      `bson:"vaas"`
	Timestamp        *time.Time  `bson:"timestamp"`
	UpdatedAt        *time.Time  `bson:"updatedAt"`
}

type MissingVaaUpdate struct {
	ID string `bson:"_id"`
}

type ObservationUpdate struct {
	MessageID    string      `bson:"messageId"`
	EmitterChain vaa.ChainID `bson:"emitterChain"`
	Emitter      string      `bson:"emitterAddr"`
	TargetChain  vaa.ChainID `bson:"targetChain"`
	Sequence     uint64      `bson:"sequence"`
	Hash         []byte      `bson:"hash"`
	TxId         []byte      `bson:"txId"`
	GuardianAddr string      `bson:"guardianAddr"`
	Signature    []byte      `bson:"signature"`
	UpdatedAt    *time.Time  `bson:"updatedAt"`
}

func indexedAt(t time.Time) IndexingTimestamps {
	return IndexingTimestamps{
		IndexedAt: t,
	}
}

// MongoStatus represent a mongo server status.
type MongoStatus struct {
	Ok          int32             `bson:"ok"`
	Host        string            `bson:"host"`
	Version     string            `bson:"version"`
	Process     string            `bson:"process"`
	Pid         int32             `bson:"pid"`
	Uptime      int32             `bson:"uptime"`
	Connections *MongoConnections `bson:"connections"`
}

// MongoConnections represents a mongo server connection.
type MongoConnections struct {
	Current      int32 `bson:"current"`
	Available    int32 `bson:"available"`
	TotalCreated int32 `bson:"totalCreated"`
}

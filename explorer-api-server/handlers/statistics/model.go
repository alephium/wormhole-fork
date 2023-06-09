package statistics

import (
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
)

type StatisticDoc struct {
	ID                  string      `bson:"_id" json:"id"`
	Date                *time.Time  `bson:"date" json:"date"`
	EmitterChain        vaa.ChainID `bson:"emitterChain" json:"emitterChain"`
	EmitterAddr         string      `bson:"emitterAddr" json:"emitterAddr"`
	TokenChain          vaa.ChainID `bson:"tokenChain" json:"tokenChain"`
	TargetChain         vaa.ChainID `bson:"targetChain" json:"targetChain"`
	TokenAddress        string      `bson:"tokenAddress" json:"tokenAddress"`
	TotalVAACount       uint32      `bson:"totalVAACount" json:"totalVAACount"`
	TotalTransferAmount string      `bson:"totalTransferAmount" json:"totalTransferAmount"`
	TotalNotionalUSD    float64     `bson:"totalNotionalUSD" json:"totalNotionalUSD"`
	UpdatedAt           *time.Time  `bson:"updatedAt" json:"updatedAt"`
}

type TokenDoc struct {
	ID              string      `bson:"_id" json:"id"`
	TokenAddress    string      `bson:"tokenAddress" json:"tokenAddress"`
	TokenChain      vaa.ChainID `bson:"tokenChain" json:"tokenChain"`
	Decimals        uint8       `bson:"decimals" json:"decimals"`
	Symbol          string      `bson:"symbol" json:"symbol"`
	Name            string      `bson:"name" json:"name"`
	NativeAddress   string      `bson:"nativeAddress" json:"nativeAddress"`
	CoinGeckoCoinId string      `bson:"coinGeckoCoinId" json:"coinGeckoCoinId"`
	UpdatedAt       *time.Time  `bson:"updatedAt" json:"updatedAt"`
}

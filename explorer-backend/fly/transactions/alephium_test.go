package transactions

import (
	"crypto/rand"
	"testing"

	sdk "github.com/alephium/go-sdk"
	"github.com/alephium/wormhole-fork/node/pkg/alephium"
	"github.com/test-go/testify/assert"
)

func randomHash() string {
	var byte32 alephium.Byte32
	rand.Read(byte32[:])
	return byte32.ToHex()
}

func randomContractEvent(blockHash string) sdk.ContractEvent {
	return sdk.ContractEvent{
		BlockHash: blockHash,
		TxId:      randomHash(),
	}
}

func TestFromContractEvents(t *testing.T) {
	blockHash0 := randomHash()
	blockHash1 := randomHash()
	blockHash2 := randomHash()
	blockHash3 := randomHash()

	contractEvents0 := &sdk.ContractEvents{
		Events: []sdk.ContractEvent{
			randomContractEvent(blockHash0),
			randomContractEvent(blockHash0),
			randomContractEvent(blockHash0),
		},
	}

	result0 := fromContractEvents(contractEvents0, 0)
	assert.Equal(t, len(result0), 1)
	assert.Equal(t, result0[0].eventIndex, uint32(0))
	assert.Equal(t, len(result0[0].events), 3)

	contractEvents1 := &sdk.ContractEvents{
		Events: []sdk.ContractEvent{
			randomContractEvent(blockHash0),
			randomContractEvent(blockHash1),
			randomContractEvent(blockHash2),
			randomContractEvent(blockHash3),
			randomContractEvent(blockHash3),
		},
	}

	result1 := fromContractEvents(contractEvents1, 0)
	assert.Equal(t, len(result1), 4)
	assert.Equal(t, result1[0].eventIndex, uint32(0))
	assert.Equal(t, len(result1[0].events), 1)
	assert.Equal(t, result1[1].eventIndex, uint32(1))
	assert.Equal(t, len(result1[1].events), 1)
	assert.Equal(t, result1[2].eventIndex, uint32(2))
	assert.Equal(t, len(result1[2].events), 1)
	assert.Equal(t, result1[3].eventIndex, uint32(3))
	assert.Equal(t, len(result1[3].events), 2)

	contractEvents2 := &sdk.ContractEvents{
		Events: []sdk.ContractEvent{
			randomContractEvent(blockHash0),
			randomContractEvent(blockHash0),
			randomContractEvent(blockHash0),
			randomContractEvent(blockHash1),
			randomContractEvent(blockHash1),
			randomContractEvent(blockHash2),
			randomContractEvent(blockHash2),
			randomContractEvent(blockHash2),
			randomContractEvent(blockHash2),
			randomContractEvent(blockHash3),
		},
	}

	result2 := fromContractEvents(contractEvents2, 1)
	assert.Equal(t, len(result2), 4)
	assert.Equal(t, result2[0].eventIndex, uint32(1))
	assert.Equal(t, len(result2[0].events), 3)
	assert.Equal(t, result2[1].eventIndex, uint32(2))
	assert.Equal(t, len(result2[1].events), 2)
	assert.Equal(t, result2[2].eventIndex, uint32(3))
	assert.Equal(t, len(result2[2].events), 4)
	assert.Equal(t, result2[3].eventIndex, uint32(4))
	assert.Equal(t, len(result2[3].events), 1)
}

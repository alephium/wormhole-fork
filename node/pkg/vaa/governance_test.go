package vaa

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// Testing the expected default behavior of a CreateGovernanceVAA
func TestCreateGovernanceVAA(t *testing.T) {
	var governanceEmitterAddress = Address{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 4}
	var governanceChainId = ChainIDAlephium
	var nonce uint32 = 1
	var sequence uint64 = 1
	var targetChainId ChainID = ChainIDEthereum
	var guardianSetIndex uint32 = 1
	var payload = []byte{97, 97, 97, 97, 97, 97}
	var timestamp = time.Unix(1000, 0)
	var expectedGovernanceEmitter = Address{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 4}

	got_vaa := CreateGovernanceVAA(governanceChainId, governanceEmitterAddress, timestamp, nonce, sequence, targetChainId, guardianSetIndex, payload)

	want_vaa := &VAA{
		Version:          uint8(1),
		GuardianSetIndex: uint32(1),
		Signatures:       nil,
		Timestamp:        timestamp,
		Nonce:            uint32(1),
		Sequence:         uint64(1),
		ConsistencyLevel: uint8(32),
		EmitterChain:     ChainIDAlephium,
		TargetChain:      ChainIDEthereum,
		EmitterAddress:   expectedGovernanceEmitter,
		Payload:          payload,
	}

	assert.Equal(t, got_vaa, want_vaa)
}

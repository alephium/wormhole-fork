package db

import (
	"math/rand"
	"sort"
	"testing"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/stretchr/testify/assert"
)

func randomAddress() vaa.Address {
	var addr vaa.Address
	rand.Read(addr[:])
	return addr
}

func randomPayload() []byte {
	payload := make([]byte, 40)
	rand.Read(payload)
	return payload
}

func randomSignature() *vaa.Signature {
	var signatureData vaa.SignatureData
	rand.Read(signatureData[:])
	return &vaa.Signature{
		Index:     0,
		Signature: signatureData,
	}
}

func TestFindEmitterSequenceGap(t *testing.T) {
	emitterAddress := randomAddress()
	toEthPrefix := VAAID{
		EmitterChain:   vaa.ChainIDAlephium,
		EmitterAddress: emitterAddress,
		TargetChain:    vaa.ChainIDEthereum,
	}
	toBscPrefix := VAAID{
		EmitterChain:   vaa.ChainIDAlephium,
		EmitterAddress: emitterAddress,
		TargetChain:    vaa.ChainIDBSC,
	}

	db, err := Open(t.TempDir())
	assert.Nil(t, err)

	addVAA := func(prefix VAAID, sequence uint64) {
		err := db.StoreSignedVAA(&vaa.VAA{
			Version:        1,
			EmitterChain:   prefix.EmitterChain,
			EmitterAddress: prefix.EmitterAddress,
			TargetChain:    prefix.TargetChain,
			Sequence:       sequence,
			Signatures:     []*vaa.Signature{randomSignature()},
			Payload:        randomPayload(),
		})
		assert.Nil(t, err)
	}

	addVAA(toEthPrefix, 0)
	addVAA(toEthPrefix, 3)
	addVAA(toEthPrefix, 5)
	resp, first, last, err := db.FindEmitterSequenceGap(toEthPrefix)
	assert.Equal(t, resp, []uint64{1, 2, 4})
	assert.Equal(t, first, uint64(0))
	assert.Equal(t, last, uint64(5))
	assert.Nil(t, err)

	addVAA(toBscPrefix, 3)
	addVAA(toBscPrefix, 8)
	resp, first, last, err = db.FindEmitterSequenceGap(toBscPrefix)
	assert.Equal(t, resp, []uint64{0, 1, 2, 4, 5, 6, 7})
	assert.Equal(t, first, uint64(0))
	assert.Equal(t, last, uint64(8))
	assert.Nil(t, err)
}

func randomGovernanceVAA(targetChainId vaa.ChainID) *vaa.VAA {
	return &vaa.VAA{
		Version:        1,
		EmitterChain:   vaa.GovernanceChain,
		EmitterAddress: vaa.GovernanceEmitter,
		TargetChain:    targetChainId,
		Sequence:       rand.Uint64(),
		Signatures:     []*vaa.Signature{randomSignature()},
		Payload:        randomPayload(),
	}
}

func maxU64(a, b uint64) uint64 {
	if a > b {
		return a
	}
	return b
}

func TestMaxGovernanceVAASequence(t *testing.T) {
	db, err := Open(t.TempDir())
	assert.Nil(t, err)

	maxSeq, err := db.MaxGovernanceVAASequence()
	assert.Nil(t, err)
	assert.Equal(t, *maxSeq, uint64(0))

	sequences0 := make([]uint64, 0)
	for i := 0; i < 10; i++ {
		vaa := randomGovernanceVAA(vaa.ChainIDUnset)
		err = db.StoreSignedVAA(vaa)
		assert.Nil(t, err)
		sequences0 = append(sequences0, vaa.Sequence)
	}

	sortSequences := func(seqs []uint64) {
		sort.Slice(seqs, func(i, j int) bool {
			return seqs[i] < seqs[j]
		})
	}
	sortSequences(sequences0)
	maxSequence0 := sequences0[len(sequences0)-1]
	maxSeq, err = db.MaxGovernanceVAASequence()
	assert.Nil(t, err)
	assert.Equal(t, *maxSeq, maxSequence0)

	sequences1 := make([]uint64, 0)
	sortSequences(sequences1)

	for i := 0; i < 10; i++ {
		vaa := randomGovernanceVAA(vaa.ChainIDAlephium)
		err = db.StoreSignedVAA(vaa)
		assert.Nil(t, err)
		sequences1 = append(sequences1, vaa.Sequence)
	}
	sortSequences(sequences1)
	maxSequence1 := sequences1[len(sequences1)-1]
	maxSeq, err = db.MaxGovernanceVAASequence()
	assert.Nil(t, err)
	assert.Equal(t, *maxSeq, maxU64(maxSequence0, maxSequence1))
}

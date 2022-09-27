package db

import (
	"math/rand"
	"sort"
	"testing"

	"github.com/certusone/wormhole/node/pkg/vaa"
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

func TestNextGovernanceVAASequence(t *testing.T) {
	db, err := Open(t.TempDir())
	assert.Nil(t, err)

	for chainId := 0; chainId <= 10; chainId++ {
		nextSeq, err := db.MaxGovernanceVAASequence(vaa.ChainIDAlephium)
		assert.Nil(t, err)
		assert.Equal(t, *nextSeq, uint64(0))
	}

	targetChainId0 := vaa.ChainIDUnset
	targetChainId1 := vaa.ChainIDAlephium
	sequences0 := make([]uint64, 0)
	sequences1 := make([]uint64, 0)
	for i := 0; i < 10; i++ {
		vaa0 := randomGovernanceVAA(targetChainId0)
		err = db.StoreSignedVAA(vaa0)
		assert.Nil(t, err)
		sequences0 = append(sequences0, vaa0.Sequence)

		vaa1 := randomGovernanceVAA(targetChainId1)
		err = db.StoreSignedVAA(vaa1)
		assert.Nil(t, err)
		sequences1 = append(sequences1, vaa1.Sequence)
	}

	sortSequences := func(seqs []uint64) {
		sort.Slice(seqs, func(i, j int) bool {
			return seqs[i] < seqs[j]
		})
	}
	sortSequences(sequences0)
	sortSequences(sequences1)

	nextSequence0 := sequences0[len(sequences0)-1]
	nextSeq, err := db.MaxGovernanceVAASequence(targetChainId0)
	assert.Nil(t, err)
	assert.Equal(t, *nextSeq, nextSequence0)

	nextSequence1 := sequences1[len(sequences1)-1]
	nextSeq, err = db.MaxGovernanceVAASequence(targetChainId1)
	assert.Nil(t, err)
	assert.Equal(t, *nextSeq, nextSequence1)
}

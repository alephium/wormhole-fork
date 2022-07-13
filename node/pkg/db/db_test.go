package db

import (
	"math/rand"
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

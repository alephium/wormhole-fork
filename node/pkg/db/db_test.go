package db

import (
	"bytes"
	"crypto/ecdsa"
	"crypto/rand"
	mathRand "math/rand"
	"os"
	"testing"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
)

var GovernanceEmitter = vaa.Address{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4}
var GovernanceChain = vaa.ChainIDAlephium

func randomAddress() vaa.Address {
	var addr vaa.Address
	mathRand.Read(addr[:])
	return addr
}

func randomPayload() []byte {
	payload := make([]byte, 40)
	mathRand.Read(payload)
	return payload
}

func randomSignature() *vaa.Signature {
	var signatureData vaa.SignatureData
	mathRand.Read(signatureData[:])
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
		EmitterChain:   GovernanceChain,
		EmitterAddress: GovernanceEmitter,
		TargetChain:    targetChainId,
		Sequence:       mathRand.Uint64(),
		Signatures:     []*vaa.Signature{randomSignature()},
		Payload:        randomPayload(),
	}
}

func TestGetGovernanceVAASequence(t *testing.T) {
	db, err := Open(t.TempDir())
	assert.Nil(t, err)

	vaas := make([]*GovernanceVAA, 0)
	for i := 0; i < 5; i++ {
		v := randomGovernanceVAA(vaa.ChainIDUnset)
		v.Sequence = uint64(i)
		err = db.StoreSignedVAA(v)
		assert.Nil(t, err)
		vaaBytes, err := v.Marshal()
		assert.Nil(t, err)
		vaas = append(vaas, &GovernanceVAA{
			TargetChain: vaa.ChainIDUnset,
			Sequence:    v.Sequence,
			VaaBytes:    vaaBytes,
		})
	}

	checkEqual := func(left, right []*GovernanceVAA) {
		assert.Equal(t, len(left), len(right))
		for i := 0; i < len(left); i++ {
			l := left[i]
			r := right[i]
			assert.Equal(t, l.TargetChain, r.TargetChain)
			assert.Equal(t, l.Sequence, r.Sequence)
			assert.True(t, bytes.Equal(l.VaaBytes, r.VaaBytes))
		}
	}

	test := func(sequences []uint64, expected []*GovernanceVAA) {
		res, err := db.GetGovernanceVAABatch(GovernanceChain, GovernanceEmitter, sequences)
		assert.Nil(t, err)
		checkEqual(res, expected)
	}

	sequences := make([]uint64, 0)
	for i := 0; i < 5; i++ {
		sequences = append(sequences, uint64(i))
		test(sequences, vaas[0:(i+1)])
	}

	test([]uint64{2, 4}, []*GovernanceVAA{vaas[2], vaas[4]})
	test([]uint64{0, 1, 2, 3, 4, 5, 6, 7}, vaas)

	for i := 0; i < 5; i++ {
		v := randomGovernanceVAA(vaa.ChainIDAlephium)
		v.Sequence = uint64(i + 10)
		err = db.StoreSignedVAA(v)
		assert.Nil(t, err)
		vaaBytes, err := v.Marshal()
		assert.Nil(t, err)
		vaas = append(vaas, &GovernanceVAA{
			TargetChain: vaa.ChainIDAlephium,
			Sequence:    v.Sequence,
			VaaBytes:    vaaBytes,
		})
	}

	test([]uint64{4, 5, 6, 7, 8, 9, 10}, vaas[4:6])
	test([]uint64{0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16}, vaas)
}

func TestNextGovernanceVAASequence(t *testing.T) {
	db, err := Open(t.TempDir())
	assert.Nil(t, err)

	nextSeq, err := db.NextGovernanceVAASequence(GovernanceChain, GovernanceEmitter)
	assert.Nil(t, err)
	assert.Equal(t, *nextSeq, uint64(0))

	vaa0 := randomGovernanceVAA(vaa.ChainIDUnset)
	vaa0.Sequence = uint64(0)
	err = db.StoreSignedVAA(vaa0)
	assert.Nil(t, err)
	nextSeq, err = db.NextGovernanceVAASequence(GovernanceChain, GovernanceEmitter)
	assert.Nil(t, err)
	assert.Equal(t, *nextSeq, uint64(1))

	maxSequence := uint64(0)
	for i := 0; i < 10; i++ {
		vaa := randomGovernanceVAA(vaa.ChainIDUnset)
		err = db.StoreSignedVAA(vaa)
		assert.Nil(t, err)
		if vaa.Sequence > maxSequence {
			maxSequence = vaa.Sequence
		}
	}

	nextSeq, err = db.NextGovernanceVAASequence(GovernanceChain, GovernanceEmitter)
	assert.Nil(t, err)
	assert.Equal(t, *nextSeq, maxSequence+1)

	for i := 0; i < 10; i++ {
		vaa := randomGovernanceVAA(vaa.ChainIDAlephium)
		err = db.StoreSignedVAA(vaa)
		assert.Nil(t, err)
		if vaa.Sequence > maxSequence {
			maxSequence = vaa.Sequence
		}
	}
	nextSeq, err = db.NextGovernanceVAASequence(GovernanceChain, GovernanceEmitter)
	assert.Nil(t, err)
	assert.Equal(t, *nextSeq, maxSequence+1)
}

func getVAA() vaa.VAA {
	var payload = []byte{97, 97, 97, 97, 97, 97}
	var governanceEmitter = vaa.Address{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4}

	return vaa.VAA{
		Version:          uint8(1),
		GuardianSetIndex: uint32(1),
		Signatures:       nil,
		Timestamp:        time.Unix(0, 0),
		Nonce:            uint32(1),
		Sequence:         uint64(1),
		ConsistencyLevel: uint8(32),
		EmitterChain:     vaa.ChainIDSolana,
		TargetChain:      vaa.ChainIDEthereum,
		EmitterAddress:   governanceEmitter,
		Payload:          payload,
	}
}

// Testing the expected default behavior of a CreateGovernanceVAA
func TestVaaIDFromString(t *testing.T) {
	vaaIdString := "1/0000000000000000000000000000000000000000000000000000000000000004/2/1"
	vaaID, _ := VaaIDFromString(vaaIdString)
	expectAddr := vaa.Address{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4}

	assert.Equal(t, vaa.ChainIDSolana, vaaID.EmitterChain)
	assert.Equal(t, expectAddr, vaaID.EmitterAddress)
	assert.Equal(t, vaa.ChainIDEthereum, vaaID.TargetChain)
	assert.Equal(t, uint64(1), vaaID.Sequence)
}

func TestVaaIDFromVAA(t *testing.T) {
	testVaa := getVAA()
	vaaID := VaaIDFromVAA(&testVaa)
	expectAddr := vaa.Address{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4}

	assert.Equal(t, vaa.ChainIDSolana, vaaID.EmitterChain)
	assert.Equal(t, expectAddr, vaaID.EmitterAddress)
	assert.Equal(t, vaa.ChainIDEthereum, vaaID.TargetChain)
	assert.Equal(t, uint64(1), vaaID.Sequence)
}

func TestBytes(t *testing.T) {
	vaaIdString := "1/0000000000000000000000000000000000000000000000000000000000000004/2/1"
	vaaID, _ := VaaIDFromString(vaaIdString)
	expected := []byte{0x73, 0x69, 0x67, 0x6e, 0x65, 0x64, 0x2f, 0x31, 0x2f, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x34, 0x2f, 0x32, 0x2f, 0x31}

	assert.Equal(t, expected, vaaID.Bytes())
}

func TestEmitterPrefixBytes(t *testing.T) {
	vaaIdString := "1/0000000000000000000000000000000000000000000000000000000000000004/2/1"
	vaaID, _ := VaaIDFromString(vaaIdString)
	expected := []byte{0x73, 0x69, 0x67, 0x6e, 0x65, 0x64, 0x2f, 0x31, 0x2f, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x34, 0x2f, 0x32}

	assert.Equal(t, expected, vaaID.EmitterPrefixBytes())
}

func TestGovernanceEmitterPrefixBytes(t *testing.T) {
	vaaIdString := "1/0000000000000000000000000000000000000000000000000000000000000004/2/1"
	vaaID, _ := VaaIDFromString(vaaIdString)
	expected := []byte{0x73, 0x69, 0x67, 0x6e, 0x65, 0x64, 0x2f, 0x31, 0x2f, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x30, 0x34}

	assert.Equal(t, expected, vaaID.GovernanceEmitterPrefixBytes())
}

func TestStoreSignedVAAUnsigned(t *testing.T) {
	dbPath := t.TempDir()
	db, err := Open(dbPath)
	if err != nil {
		t.Error("failed to open database")
	}
	defer db.Close()
	defer os.Remove(dbPath)

	testVaa := getVAA()

	// Should panic because the VAA is not signed
	assert.Panics(t, func() { db.StoreSignedVAA(&testVaa) }, "The code did not panic") //nolint:errcheck
}

func TestStoreSignedVAASigned(t *testing.T) {
	dbPath := t.TempDir()
	db, err := Open(dbPath)
	if err != nil {
		t.Error("failed to open database")
	}
	defer db.Close()
	defer os.Remove(dbPath)

	testVaa := getVAA()

	privKey, _ := ecdsa.GenerateKey(crypto.S256(), rand.Reader)
	testVaa.AddSignature(privKey, 0)

	err2 := db.StoreSignedVAA(&testVaa)
	assert.NoError(t, err2)
}

func TestGetSignedVAABytes(t *testing.T) {
	dbPath := t.TempDir()
	db, err := Open(dbPath)
	if err != nil {
		t.Error("failed to open database")
	}
	defer db.Close()
	defer os.Remove(dbPath)

	testVaa := getVAA()

	vaaID := VaaIDFromVAA(&testVaa)

	privKey, _ := ecdsa.GenerateKey(crypto.S256(), rand.Reader)
	testVaa.AddSignature(privKey, 0)

	// Store full VAA
	err2 := db.StoreSignedVAA(&testVaa)
	assert.NoError(t, err2)

	// Retrieve it using vaaID
	vaaBytes, err2 := db.GetSignedVAABytes(*vaaID)
	assert.NoError(t, err2)

	testVaaBytes, err3 := testVaa.Marshal()
	assert.NoError(t, err3)

	assert.Equal(t, testVaaBytes, vaaBytes)
}

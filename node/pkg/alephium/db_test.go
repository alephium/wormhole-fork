package alephium

import (
	"math/rand"
	"testing"

	"github.com/btcsuite/btcutil/base58"
	nodev1 "github.com/certusone/wormhole/node/pkg/proto/node/v1"
	"github.com/dgraph-io/badger/v3"
	"github.com/stretchr/testify/assert"
)

func randomByte32() Byte32 {
	var byte32 Byte32
	size, err := rand.Read(byte32[:])
	assume(size == 32)
	assume(err == nil)
	return byte32
}

func randomAddress() string {
	var bytes []byte
	byte32 := randomByte32()
	bytes = append([]byte{3}, byte32[:]...)
	return base58.Encode(bytes)
}

func TestUpdateUndoneSequenceStatus(t *testing.T) {
	db, err := Open(t.TempDir())
	assert.Nil(t, err)
	defer db.Close()

	sequence := uint64(10)
	remoteChainId := uint16(2)
	err = db.addUndoneSequence(remoteChainId, sequence)
	assert.Nil(t, err)

	err = db.addUndoneSequence(remoteChainId, sequence)
	assert.Equal(t, err.Error(), "sequence 10 from remote chain 2 already exist")

	err = db.SetSequenceExecuting(remoteChainId, sequence)
	assert.Nil(t, err)
	status, err := db.getUndoneSequence(remoteChainId, sequence)
	assert.Nil(t, err)
	assert.Equal(t, status, []byte{sequenceExecuting})

	err = db.SetSequenceExecuting(remoteChainId, sequence)
	assert.Equal(t, err.Error(), "failed to set sequence executing, status [2], sequence 10, remoteChainId 2")
	err = db.SetSequenceExecuting(remoteChainId, sequence+1)
	assert.Equal(t, err, badger.ErrKeyNotFound)

	err = db.setSequenceExecuted(remoteChainId, sequence)
	assert.Nil(t, err)
	err = db.setSequenceExecuted(remoteChainId, sequence+1)
	assert.Equal(t, err, badger.ErrKeyNotFound)

	err = db.SetSequenceExecuting(remoteChainId, sequence)
	assert.Equal(t, err.Error(), "failed to set sequence executing, status [3], sequence 10, remoteChainId 2")
}

func TestGetUndoneSequences(t *testing.T) {
	status := []byte{sequenceInit, sequenceExecuting, sequenceExecuted}
	remoteChainId0 := uint16(10)
	remoteChainId1 := uint16(11)
	sequenceSize := 1000
	sequences0 := make([]*nodev1.UndoneSequence, sequenceSize)
	sequences1 := make([]*nodev1.UndoneSequence, sequenceSize)

	db, err := Open(t.TempDir())
	assert.Nil(t, err)
	defer db.Close()

	for i := 0; i < sequenceSize; i++ {
		s := &nodev1.UndoneSequence{
			Sequence: uint64(i),
			Status:   toProtoStatus(status[rand.Int()%2]),
		}
		sequences0[i] = s
		sequences1[i] = s
		key0 := UndoneSequenceKey{
			remoteChainId: remoteChainId0,
			sequence:      uint64(i),
		}
		db.put(key0.encode(), []byte{byte(s.Status)})
		key1 := UndoneSequenceKey{
			remoteChainId: remoteChainId1,
			sequence:      uint64(i),
		}
		db.put(key1.encode(), []byte{byte(s.Status)})
	}

	result0, err := db.GetUndoneSequences(remoteChainId0)
	assert.Nil(t, err)
	result1, err := db.GetUndoneSequences(remoteChainId1)
	assert.Nil(t, err)
	assert.Equal(t, len(result0), sequenceSize)
	assert.Equal(t, len(result1), sequenceSize)
	for i := 0; i < sequenceSize; i++ {
		assert.Equal(t, result0[i].Sequence, sequences0[i].Sequence)
		assert.Equal(t, result0[i].Status, sequences0[i].Status)
		assert.Equal(t, result1[i].Sequence, sequences0[i].Sequence)
		assert.Equal(t, result1[i].Status, sequences0[i].Status)
	}
}

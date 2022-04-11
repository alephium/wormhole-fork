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
	bytes := make([]byte, 0)
	byte32 := randomByte32()
	bytes = append([]byte{3}, byte32[:]...)
	return base58.Encode(bytes)
}

func randomUint16() uint16 {
	return uint16(rand.Int63() >> 47)
}

type testData struct {
	chainId              uint16
	chainContractAddress string
	tokenId              Byte32
	tokenWrapperAddress  string
	lastHeight           uint32
}

func randTestData() *testData {
	return &testData{
		chainId:              randomUint16(),
		chainContractAddress: randomAddress(),
		tokenId:              randomByte32(),
		tokenWrapperAddress:  randomAddress(),
		lastHeight:           rand.Uint32(),
	}
}

func TestReadWrite(t *testing.T) {
	td := randTestData()
	db, err := Open(t.TempDir())
	assert.Nil(t, err)
	defer db.Close()

	_, err = db.getRemoteChain(td.chainId)
	assert.Equal(t, err, badger.ErrKeyNotFound)
	err = db.addRemoteChain(td.chainId, td.chainContractAddress)
	assert.Nil(t, err)
	chainContractId, err := db.getRemoteChain(td.chainId)
	assert.Nil(t, err)
	assert.Equal(t, chainContractId, td.chainContractAddress)

	_, err = db.GetRemoteTokenWrapper(td.tokenId)
	assert.Equal(t, err, badger.ErrKeyNotFound)
	err = db.addRemoteTokenWrapper(td.tokenId, td.tokenWrapperAddress)
	assert.Nil(t, err)
	tokenWrapperId, err := db.GetRemoteTokenWrapper(td.tokenId)
	assert.Nil(t, err)
	assert.Equal(t, tokenWrapperId, td.tokenWrapperAddress)
}

func TestBatchWrite(t *testing.T) {
	td := randTestData()
	db, err := Open(t.TempDir())
	assert.Nil(t, err)
	defer db.Close()

	batch := newBatch()
	batch.writeTokenBridgeForChain(td.chainId, td.chainContractAddress)
	batch.writeRemoteTokenWrapper(td.tokenId, td.tokenWrapperAddress)

	err = db.writeBatch(batch)
	assert.Nil(t, err)

	chainContractId, err := db.getRemoteChain(td.chainId)
	assert.Nil(t, err)
	assert.Equal(t, chainContractId, td.chainContractAddress)

	tokenWrapperId, err := db.GetRemoteTokenWrapper(td.tokenId)
	assert.Nil(t, err)
	assert.Equal(t, tokenWrapperId, td.tokenWrapperAddress)
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

func TestLocalTokenWrapperExist(t *testing.T) {
	db, err := Open(t.TempDir())
	assert.Nil(t, err)
	defer db.Close()

	key := &LocalTokenWrapperKey{
		localTokenId:  randomByte32(),
		remoteChainId: uint16(3),
	}

	batch0 := newBatch()
	exist, err := batch0.localTokenWrapperExist(key, db)
	assert.Nil(t, err)
	assert.False(t, exist)

	wrapperAddress := randomAddress()
	batch0.writeLocalTokenWrapper(key.localTokenId, key.remoteChainId, wrapperAddress)
	exist, err = batch0.localTokenWrapperExist(key, db)
	assert.Nil(t, err)
	assert.True(t, exist)

	err = db.writeBatch(batch0)
	assert.Nil(t, err)

	batch1 := newBatch()
	exist, err = batch1.localTokenWrapperExist(key, db)
	assert.Nil(t, err)
	assert.True(t, exist)
}

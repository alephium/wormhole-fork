package alephium

import (
	"math/rand"
	"testing"

	"github.com/btcsuite/btcutil/base58"
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
	latestHeight         uint32
}

func randTestData() *testData {
	return &testData{
		chainId:              randomUint16(),
		chainContractAddress: randomAddress(),
		tokenId:              randomByte32(),
		tokenWrapperAddress:  randomAddress(),
		latestHeight:         rand.Uint32(),
	}
}

func TestReadWrite(t *testing.T) {
	td := randTestData()
	db, err := open(t.TempDir())
	assert.Nil(t, err)

	_, err = db.getLatestHeight()
	assert.Equal(t, err, badger.ErrKeyNotFound)
	err = db.updateLatestHeight(td.latestHeight)
	assert.Nil(t, err)
	latestHeight, err := db.getLatestHeight()
	assert.Nil(t, err)
	assert.Equal(t, latestHeight, td.latestHeight)

	_, err = db.getRemoteChain(td.chainId)
	assert.Equal(t, err, badger.ErrKeyNotFound)
	err = db.addRemoteChain(td.chainId, td.chainContractAddress)
	assert.Nil(t, err)
	chainContractId, err := db.getRemoteChain(td.chainId)
	assert.Nil(t, err)
	assert.Equal(t, chainContractId, td.chainContractAddress)

	_, err = db.getTokenWrapper(td.tokenId)
	assert.Equal(t, err, badger.ErrKeyNotFound)
	err = db.addTokenWrapper(td.tokenId, td.tokenWrapperAddress)
	assert.Nil(t, err)
	tokenWrapperId, err := db.getTokenWrapper(td.tokenId)
	assert.Nil(t, err)
	assert.Equal(t, tokenWrapperId, td.tokenWrapperAddress)
}

func TestBatchWrite(t *testing.T) {
	td := randTestData()
	db, err := open(t.TempDir())
	assert.Nil(t, err)

	batch := newBatch()
	batch.updateHeight(td.latestHeight)
	batch.writeChain(td.chainId, td.chainContractAddress)
	batch.writeTokenWrapper(td.tokenId, td.tokenWrapperAddress)

	err = db.writeBatch(batch)
	assert.Nil(t, err)

	latestHeight, err := db.getLatestHeight()
	assert.Nil(t, err)
	assert.Equal(t, latestHeight, td.latestHeight)

	chainContractId, err := db.getRemoteChain(td.chainId)
	assert.Nil(t, err)
	assert.Equal(t, chainContractId, td.chainContractAddress)

	tokenWrapperId, err := db.getTokenWrapper(td.tokenId)
	assert.Nil(t, err)
	assert.Equal(t, tokenWrapperId, td.tokenWrapperAddress)
}

package alephium

import (
	"encoding/binary"
	"fmt"

	"github.com/dgraph-io/badger/v3"
)

type db struct {
	*badger.DB
}

var (
	remoteTokenWrapperPrefix        = []byte("remote-token-wrapper")
	localTokenWrapperPrefix         = []byte("local-token-wrapper")
	tokenBridgeForChainPrefix       = []byte("token-bridge-for-chain")
	lastTokenBridgeEventIndexKey    = []byte("last-token-bridge-event-index")
	lastTokenWrapperFactoryIndexKey = []byte("last-token-wrapper-factory-index")
)

func open(path string) (*db, error) {
	database, err := badger.Open(badger.DefaultOptions(path))
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	return &db{
		database,
	}, nil
}

func (db *db) put(key []byte, value []byte) error {
	return db.Update(func(txn *badger.Txn) error {
		return txn.Set(key, value)
	})
}

func (db *db) get(key []byte) (b []byte, err error) {
	err = db.View(func(txn *badger.Txn) error {
		item, err := txn.Get(key)
		if err != nil {
			return err
		}
		val, err := item.ValueCopy(nil)
		if err != nil {
			return err
		}
		b = val
		return nil
	})
	return
}

func (db *db) addRemoteTokenWrapper(tokenId Byte32, tokenWrapperAddress string) error {
	return db.put(remoteTokenWrapperKey(tokenId), []byte(tokenWrapperAddress))
}

func (db *db) getRemoteTokenWrapper(tokenId Byte32) (string, error) {
	value, err := db.get(remoteTokenWrapperKey(tokenId))
	if err != nil {
		return "", err
	}
	return string(value), nil
}

func (db *db) addLocalTokenWrapper(tokenId Byte32, remoteChainId uint16, tokenWrapperAddress string) error {
	return db.put(localTokenWrapperKey(tokenId, remoteChainId), []byte(tokenWrapperAddress))
}

func (db *db) getLocalTokenWrapper(tokenId Byte32, remoteChainId uint16) (string, error) {
	value, err := db.get(localTokenWrapperKey(tokenId, remoteChainId))
	if err != nil {
		return "", err
	}
	return string(value), nil
}

func (db *db) addRemoteChain(chainId uint16, tokenBridgeForChainAddress string) error {
	return db.put(chainKey(chainId), []byte(tokenBridgeForChainAddress))
}

func (db *db) getRemoteChain(chainId uint16) (string, error) {
	value, err := db.get(chainKey(chainId))
	if err != nil {
		return "", err
	}
	return string(value), nil
}

func (db *db) getLastTokenBridgeEventIndex() (*uint64, error) {
	bytes, err := db.get(lastTokenBridgeEventIndexKey)
	if err != nil {
		return nil, err
	}
	index := binary.BigEndian.Uint64(bytes)
	return &index, nil
}

func (db *db) getLastTokenWrapperFactoryEventIndex() (*uint64, error) {
	bytes, err := db.get(lastTokenWrapperFactoryIndexKey)
	if err != nil {
		return nil, err
	}
	index := binary.BigEndian.Uint64(bytes)
	return &index, nil
}

func (db *db) writeBatch(batch *batch) error {
	return db.Update(func(txn *badger.Txn) error {
		for i, key := range batch.keys {
			if err := txn.Set(key, batch.values[i]); err != nil {
				return err
			}
		}
		return nil
	})
}

func remoteTokenWrapperKey(tokenId Byte32) []byte {
	return append(remoteTokenWrapperPrefix, tokenId[:]...)
}

func localTokenWrapperKey(tokenId Byte32, remoteChainId uint16) []byte {
	bytes := make([]byte, 2)
	binary.BigEndian.PutUint16(bytes, remoteChainId)
	var key []byte
	key = append(localTokenWrapperPrefix, tokenId[:]...)
	key = append(key, bytes[:]...)
	return key
}

func chainKey(chainId uint16) []byte {
	bytes := make([]byte, 2)
	binary.BigEndian.PutUint16(bytes, chainId)
	return append(tokenBridgeForChainPrefix, bytes...)
}

type batch struct {
	keys   [][]byte
	values [][]byte
}

func newBatch() *batch {
	return &batch{
		keys:   make([][]byte, 0),
		values: make([][]byte, 0),
	}
}

func (b *batch) writeTokenBridgeForChain(chainId uint16, contractAddress string) {
	b.keys = append(b.keys, chainKey(chainId))
	b.values = append(b.values, []byte(contractAddress))
}

func (b *batch) writeRemoteTokenWrapper(tokenId Byte32, wrapperAddress string) {
	b.keys = append(b.keys, remoteTokenWrapperKey(tokenId))
	b.values = append(b.values, []byte(wrapperAddress))
}

func (b *batch) writeLocalTokenWrapper(tokenId Byte32, remoteChainId uint16, wrapperAddress string) {
	b.keys = append(b.keys, localTokenWrapperKey(tokenId, remoteChainId))
	b.values = append(b.values, []byte(wrapperAddress))
}

func (b *batch) updateLastTokenBridgeEventIndex(index uint64) {
	bytes := make([]byte, 8)
	binary.BigEndian.PutUint64(bytes, index)
	b.keys = append(b.keys, lastTokenBridgeEventIndexKey)
	b.values = append(b.values, bytes)
}

func (b *batch) updateLastTokenWrapperFactoryEventIndex(index uint64) {
	bytes := make([]byte, 8)
	binary.BigEndian.PutUint64(bytes, index)
	b.keys = append(b.keys, lastTokenWrapperFactoryIndexKey)
	b.values = append(b.values, bytes)
}

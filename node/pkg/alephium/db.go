package alephium

import (
	"encoding/binary"
	"fmt"

	"github.com/dgraph-io/badger/v3"
)

type contractId [32]byte

type db struct {
	*badger.DB
}

var (
	tokenWrapperPrefix   = []byte("token-wrapper")
	chainPrefix          = []byte("token-bridge-for-chain")
	latestBlockHeightKey = []byte("latest-block-height")
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

func (db *db) addTokenWrapper(tokenId []byte, tokenWrapperId contractId) error {
	return db.put(tokenWrapperKey(tokenId), tokenWrapperId[:])
}

func (db *db) getTokenWrapper(tokenId []byte) (contractId, error) {
	var result contractId
	value, err := db.get(tokenWrapperKey(tokenId))
	if err != nil {
		return result, err
	}
	copy(result[:], value)
	return result, nil
}

func (db *db) addRemoteChain(chainId uint16, tokenBridgeForChainId contractId) error {
	return db.put(chainKey(chainId), tokenBridgeForChainId[:])
}

func (db *db) getRemoteChain(chainId uint16) (contractId, error) {
	var result contractId
	value, err := db.get(chainKey(chainId))
	if err != nil {
		return result, err
	}
	copy(result[:], value)
	return result, nil
}

func (db *db) updateLatestHeight(height uint32) error {
	bytes := make([]byte, 4)
	binary.BigEndian.PutUint32(bytes, height)
	return db.put(latestBlockHeightKey, bytes)
}

func (db *db) getLatestHeight() (uint32, error) {
	value, err := db.get(latestBlockHeightKey)
	if err != nil {
		return 0, err
	}
	return binary.BigEndian.Uint32(value), nil
}

func tokenWrapperKey(tokenId []byte) []byte {
	return append(tokenWrapperPrefix, tokenId...)
}

func chainKey(chainId uint16) []byte {
	bytes := make([]byte, 2)
	binary.BigEndian.PutUint16(bytes, chainId)
	return append(chainPrefix, bytes...)
}

package alephium

import (
	"bytes"
	"encoding/binary"
	"fmt"

	nodev1 "github.com/certusone/wormhole/node/pkg/proto/node/v1"
	"github.com/dgraph-io/badger/v3"
)

type Database struct {
	*badger.DB
}

var (
	remoteTokenWrapperPrefix  = []byte("remote-token-wrapper")
	localTokenWrapperPrefix   = []byte("local-token-wrapper")
	tokenBridgeForChainPrefix = []byte("token-bridge-for-chain")
	undoneSequencePrefix      = []byte("undone-sequence")

	lastTokenBridgeEventIndexKey    = []byte("last-token-bridge-event-index")
	lastTokenWrapperFactoryIndexKey = []byte("last-token-wrapper-factory-index")
	lastUndoneSequenceIndexKey      = []byte("last-undone-sequence-index")
)

const (
	sequenceInit      byte = 0
	sequenceExecuting byte = 1
	sequenceExecuted  byte = 2
)

func toProtoStatus(status byte) nodev1.UndoneSequenceStatus {
	switch status {
	case sequenceInit:
		return nodev1.UndoneSequenceStatus_INIT
	case sequenceExecuting:
		return nodev1.UndoneSequenceStatus_EXECUTING
	case sequenceExecuted:
		return nodev1.UndoneSequenceStatus_EXECUTED
	}
	panic("invalid undone sequence status")
}

func Open(path string) (*Database, error) {
	database, err := badger.Open(badger.DefaultOptions(path))
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}
	return &Database{
		database,
	}, nil
}

func (db *Database) put(key []byte, value []byte) error {
	return db.Update(func(txn *badger.Txn) error {
		return txn.Set(key, value)
	})
}

func (db *Database) get(key []byte) (b []byte, err error) {
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

func (db *Database) Close() error {
	return db.DB.Close()
}

func (db *Database) GetUndoneSequences(remoteChainId uint16) ([]*nodev1.UndoneSequence, error) {
	sequences := make([]*nodev1.UndoneSequence, 0)
	err := db.View(func(txn *badger.Txn) error {
		it := txn.NewIterator(badger.DefaultIteratorOptions)
		defer it.Close()
		prefix := append(undoneSequencePrefix, Uint16ToBytes(remoteChainId)...)
		for it.Seek(prefix); it.ValidForPrefix(prefix); it.Next() {
			item := it.Item()
			key := item.Key()
			value := make([]byte, 1)
			err := item.Value(func(v []byte) error {
				copy(value, v)
				return nil
			})
			if err != nil {
				return err
			}
			sequences = append(sequences, &nodev1.UndoneSequence{
				Sequence: binary.BigEndian.Uint64(key[len(prefix):]),
				Status:   toProtoStatus(value[0]),
			})
		}
		return nil
	})
	return sequences, err
}

func (db *Database) addRemoteTokenWrapper(tokenId Byte32, tokenWrapperAddress string) error {
	return db.put(remoteTokenWrapperKey(tokenId), []byte(tokenWrapperAddress))
}

func (db *Database) GetRemoteTokenWrapper(tokenId Byte32) (string, error) {
	value, err := db.get(remoteTokenWrapperKey(tokenId))
	if err != nil {
		return "", err
	}
	return string(value), nil
}

func (db *Database) addLocalTokenWrapper(tokenId Byte32, remoteChainId uint16, tokenWrapperAddress string) error {
	key := &LocalTokenWrapperKey{
		localTokenId:  tokenId,
		remoteChainId: remoteChainId,
	}
	return db.put(key.encode(), []byte(tokenWrapperAddress))
}

func (db *Database) GetLocalTokenWrapper(tokenId Byte32, remoteChainId uint16) (string, error) {
	key := &LocalTokenWrapperKey{
		localTokenId:  tokenId,
		remoteChainId: remoteChainId,
	}
	value, err := db.get(key.encode())
	if err != nil {
		return "", err
	}
	return string(value), nil
}

func (db *Database) addRemoteChain(chainId uint16, tokenBridgeForChainAddress string) error {
	return db.put(tokenBridgeForChainKey(chainId), []byte(tokenBridgeForChainAddress))
}

func (db *Database) getRemoteChain(chainId uint16) (string, error) {
	value, err := db.get(tokenBridgeForChainKey(chainId))
	if err != nil {
		return "", err
	}
	return string(value), nil
}

func (db *Database) getLastTokenBridgeEventIndex() (*uint64, error) {
	bytes, err := db.get(lastTokenBridgeEventIndexKey)
	if err != nil {
		return nil, err
	}
	index := binary.BigEndian.Uint64(bytes)
	return &index, nil
}

func (db *Database) getLastTokenWrapperFactoryEventIndex() (*uint64, error) {
	bytes, err := db.get(lastTokenWrapperFactoryIndexKey)
	if err != nil {
		return nil, err
	}
	index := binary.BigEndian.Uint64(bytes)
	return &index, nil
}

func (db *Database) getLastUndoneSequenceEventIndex() (*uint64, error) {
	bytes, err := db.get(lastUndoneSequenceIndexKey)
	if err != nil {
		return nil, err
	}
	index := binary.BigEndian.Uint64(bytes)
	return &index, nil
}

func (db *Database) writeBatch(batch *batch) error {
	return db.Update(func(txn *badger.Txn) error {
		for i, key := range batch.keys {
			if err := txn.Set(key, batch.values[i]); err != nil {
				return err
			}
		}
		return nil
	})
}

// TODO: store the vaa id
func (db *Database) SetSequenceExecuting(remoteChainId uint16, sequence uint64) error {
	return db.checkAndUpdateStatus(remoteChainId, sequence, []byte{sequenceInit}, []byte{sequenceExecuting})
}

func (db *Database) setSequenceExecuted(remoteChainId uint16, sequence uint64) error {
	return db.checkAndUpdateStatus(remoteChainId, sequence, []byte{sequenceExecuting}, []byte{sequenceExecuted})
}

func (db *Database) checkAndUpdateStatus(remoteChainId uint16, sequence uint64, expected []byte, updated []byte) error {
	key := &UndoneSequenceKey{
		remoteChainId: remoteChainId,
		sequence:      sequence,
	}
	keyBytes := key.encode()
	value, err := db.get(keyBytes)
	if err != nil {
		return err
	}

	if !bytes.Equal(value, expected) {
		return fmt.Errorf("invalid status %v, sequence %d, remoteChainId %d", value, sequence, remoteChainId)
	}
	return db.put(keyBytes, updated)
}

func remoteTokenWrapperKey(tokenId Byte32) []byte {
	return append(remoteTokenWrapperPrefix, tokenId[:]...)
}

type LocalTokenWrapperKey struct {
	localTokenId  Byte32
	remoteChainId uint16
}

func (k *LocalTokenWrapperKey) encode() []byte {
	var key []byte
	key = append(localTokenWrapperPrefix, k.localTokenId[:]...)
	key = append(key, Uint16ToBytes(k.remoteChainId)...)
	return key
}

func tokenBridgeForChainKey(remoteChainId uint16) []byte {
	return append(tokenBridgeForChainPrefix, Uint16ToBytes(remoteChainId)...)
}

type UndoneSequenceKey struct {
	remoteChainId uint16
	sequence      uint64
}

func (k *UndoneSequenceKey) encode() []byte {
	bytes := make([]byte, 10)
	binary.BigEndian.PutUint16(bytes, k.remoteChainId)
	binary.BigEndian.PutUint64(bytes[2:], k.sequence)
	return append(undoneSequencePrefix, bytes...)
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
	b.keys = append(b.keys, tokenBridgeForChainKey(chainId))
	b.values = append(b.values, []byte(contractAddress))
}

func (b *batch) writeRemoteTokenWrapper(tokenId Byte32, wrapperAddress string) {
	b.keys = append(b.keys, remoteTokenWrapperKey(tokenId))
	b.values = append(b.values, []byte(wrapperAddress))
}

func (b *batch) writeLocalTokenWrapper(tokenId Byte32, remoteChainId uint16, wrapperAddress string) {
	key := &LocalTokenWrapperKey{
		localTokenId:  tokenId,
		remoteChainId: remoteChainId,
	}
	b.keys = append(b.keys, key.encode())
	b.values = append(b.values, []byte(wrapperAddress))
}

func (b *batch) writeUndoneSequence(remoteChainId uint16, sequence uint64) {
	key := &UndoneSequenceKey{
		remoteChainId: remoteChainId,
		sequence:      sequence,
	}
	b.keys = append(b.keys, key.encode())
	b.values = append(b.values, []byte{sequenceInit})
}

func (b *batch) updateLastTokenBridgeEventIndex(index uint64) {
	b.keys = append(b.keys, lastTokenBridgeEventIndexKey)
	b.values = append(b.values, Uint64ToBytes(index))
}

func (b *batch) updateLastTokenWrapperFactoryEventIndex(index uint64) {
	b.keys = append(b.keys, lastTokenWrapperFactoryIndexKey)
	b.values = append(b.values, Uint64ToBytes(index))
}

func (b *batch) updateLastUndoneSequenceEventIndex(index uint64) {
	b.keys = append(b.keys, lastUndoneSequenceIndexKey)
	b.values = append(b.values, Uint64ToBytes(index))
}

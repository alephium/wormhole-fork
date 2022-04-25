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
	remoteChainIdPrefix       = []byte("remote-chain-id")
	undoneSequencePrefix      = []byte("undone-sequence")

	lastEventIndexKey = []byte("last-event-index")
)

const (
	sequenceInit      byte = 1
	sequenceExecuting byte = 2
	sequenceExecuted  byte = 3
)

func toProtoStatus(status byte) nodev1.UndoneSequenceStatus {
	switch status {
	case sequenceInit:
		return nodev1.UndoneSequenceStatus_UNDONE_SEQUENCE_STATUS_INIT
	case sequenceExecuting:
		return nodev1.UndoneSequenceStatus_UNDONE_SEQUENCE_STATUS_EXECUTING
	case sequenceExecuted:
		return nodev1.UndoneSequenceStatus_UNDONE_SEQUENCE_STATUS_EXECUTED
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

func (db *Database) addRemoteTokenWrapper(tokenId Byte32, tokenWrapperId Byte32) error {
	return db.put(remoteTokenWrapperKey(tokenId), tokenWrapperId[:])
}

func toByte32(data []byte) (*Byte32, error) {
	if len(data) != 32 {
		return nil, fmt.Errorf("invalid bytes size, expect 32, have %d", len(data))
	}
	var byte32 Byte32
	copy(byte32[:], data)
	return &byte32, nil
}

func (db *Database) GetRemoteTokenWrapper(tokenId Byte32) (*Byte32, error) {
	value, err := db.get(remoteTokenWrapperKey(tokenId))
	if err != nil {
		return nil, err
	}
	return toByte32(value)
}

func (db *Database) addLocalTokenWrapper(key *LocalTokenWrapperKey, tokenWrapperId Byte32) error {
	return db.put(key.encode(), tokenWrapperId[:])
}

func (db *Database) AddLocalTokenWrapper(tokenId Byte32, remoteChainId uint16, tokenWrapperId Byte32) error {
	key := &LocalTokenWrapperKey{
		localTokenId:  tokenId,
		remoteChainId: remoteChainId,
	}
	return db.addLocalTokenWrapper(key, tokenWrapperId)
}

func (db *Database) GetLocalTokenWrapper(tokenId Byte32, remoteChainId uint16) (*Byte32, error) {
	key := &LocalTokenWrapperKey{
		localTokenId:  tokenId,
		remoteChainId: remoteChainId,
	}
	value, err := db.get(key.encode())
	if err != nil {
		return nil, err
	}
	return toByte32(value)
}

func (db *Database) addRemoteChain(tokenBridgeForChainId Byte32, remoteChainId uint16) error {
	batch := db.NewWriteBatch()
	defer batch.Cancel()

	if err := batch.Set(tokenBridgeForChainKey(remoteChainId), tokenBridgeForChainId[:]); err != nil {
		return err
	}
	if err := batch.Set(remoteChainIdKey(tokenBridgeForChainId), Uint16ToBytes(remoteChainId)); err != nil {
		return err
	}
	return batch.Flush()
}

func (db *Database) getTokenBridgeForChain(chainId uint16) (*Byte32, error) {
	value, err := db.get(tokenBridgeForChainKey(chainId))
	if err != nil {
		return nil, err
	}
	return toByte32(value)
}

func (db *Database) getRemoteChainId(tokenBridgeForChainId Byte32) (*uint16, error) {
	value, err := db.get(remoteChainIdKey(tokenBridgeForChainId))
	if err != nil {
		return nil, err
	}
	remoteChainId := binary.BigEndian.Uint16(value)
	return &remoteChainId, nil
}

func (db *Database) updateLastEventIndex(index uint64) error {
	return db.put(lastEventIndexKey, Uint64ToBytes(index))
}

func (db *Database) getLastEventIndex() (*uint64, error) {
	value, err := db.get(lastEventIndexKey)
	if err != nil {
		return nil, err
	}
	index := binary.BigEndian.Uint64(value)
	return &index, nil
}

// TODO: store the vaa id
func (db *Database) SetSequenceExecuting(remoteChainId uint16, sequence uint64) error {
	key := &UndoneSequenceKey{
		remoteChainId: remoteChainId,
		sequence:      sequence,
	}
	keyBytes := key.encode()
	value, err := db.get(keyBytes)
	if err != nil {
		return err
	}

	if !bytes.Equal(value, []byte{sequenceInit}) {
		return fmt.Errorf("failed to set sequence executing, status %v, sequence %d, remoteChainId %d", value, sequence, remoteChainId)
	}
	return db.put(keyBytes, []byte{sequenceExecuting})
}

func (db *Database) setSequenceExecuted(remoteChainId uint16, sequence uint64) error {
	key := &UndoneSequenceKey{
		remoteChainId: remoteChainId,
		sequence:      sequence,
	}
	keyBytes := key.encode()
	// we need to make sure the sequence exist
	_, err := db.get(keyBytes)
	if err != nil {
		return err
	}
	return db.put(keyBytes, []byte{sequenceExecuted})
}

func (db *Database) addUndoneSequence(remoteChainId uint16, sequence uint64) error {
	key := &UndoneSequenceKey{
		remoteChainId: remoteChainId,
		sequence:      sequence,
	}
	keyBytes := key.encode()
	_, err := db.get(keyBytes)
	if err == badger.ErrKeyNotFound {
		return db.put(key.encode(), []byte{sequenceInit})
	}
	if err != nil {
		return err
	}
	return fmt.Errorf("sequence %v from remote chain %v already exist", sequence, remoteChainId)
}

func (db *Database) getUndoneSequence(remoteChainId uint16, sequence uint64) ([]byte, error) {
	key := &UndoneSequenceKey{
		remoteChainId: remoteChainId,
		sequence:      sequence,
	}
	return db.get(key.encode())
}

func (db *Database) localTokenWrapperExist(key *LocalTokenWrapperKey) (bool, error) {
	_, err := db.get(key.encode())
	if err == badger.ErrKeyNotFound {
		return false, nil
	}
	return err == nil, err
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

func remoteChainIdKey(contractId Byte32) []byte {
	return append(remoteChainIdPrefix, contractId[:]...)
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

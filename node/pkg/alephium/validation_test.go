package alephium

import (
	"encoding/hex"
	"errors"
	"math/big"
	"testing"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"github.com/stretchr/testify/assert"
)

func decodeHex(str string) []byte {
	bytes, err := hex.DecodeString(str)
	assume(err == nil)
	return bytes
}

func TestAttestEvent(t *testing.T) {
	attestTokenEvent := &ContractEvent{
		BlockHash:  randomByte32().ToHex(),
		TxId:       randomByte32().ToHex(),
		EventIndex: 0,
		Fields: []*Field{
			{ // sender
				Type:  "ByteVec",
				Value: "deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07",
			},
			{ // sequence
				Type:  "U256",
				Value: "100",
			},
			{ // nonce
				Type:  "ByteVec",
				Value: "12e551d9",
			},
			{ // payload
				Type:  "ByteVec",
				Value: "029fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab00ff0800000000000000000000000000000000000000000000746573742d746f6b656e00000000000000000000000000000000000000000000746573742d746f6b656e",
			},
			{ // consistencyLevel
				Type:  "U256",
				Value: "0",
			},
		},
	}

	wormholeMessage, err := attestTokenEvent.ToWormholeMessage()
	assert.Nil(t, err)
	assert.Equal(t, wormholeMessage.senderId.ToHex(), "deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07")
	assert.Equal(t, wormholeMessage.nonce, uint32(317018585))
	assert.Equal(t, wormholeMessage.payload, decodeHex("029fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab00ff0800000000000000000000000000000000000000000000746573742d746f6b656e00000000000000000000000000000000000000000000746573742d746f6b656e"))
	assert.Equal(t, wormholeMessage.Sequence, uint64(100))
	assert.Equal(t, wormholeMessage.consistencyLevel, uint8(0))
	assert.False(t, wormholeMessage.isTransferMessage())
}

func TestTransferEvent(t *testing.T) {
	transferEvent := &ContractEvent{
		BlockHash:  randomByte32().ToHex(),
		TxId:       randomByte32().ToHex(),
		EventIndex: 0,
		Fields: []*Field{
			{ // sender
				Type:  "ByteVec",
				Value: "deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07",
			},
			{ // sequence
				Type:  "U256",
				Value: "101",
			},
			{ // nonce
				Type:  "ByteVec",
				Value: "1e308999",
			},
			{ // payload
				Type:  "ByteVec",
				Value: "010000000000000000000000000000000000000000000000004563918244f400009fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab00ff0000000000000000000000000d0f183465284cb5cb426902445860456ed59b34000200000000000000000000000000000000000000000000000000005af3107a40004244dbdc1b82dd39336865f969c8d02f75642aed3ae2718dcb3256ceca8b7634",
			},
			{ // consistencyLevel
				Type:  "U256",
				Value: "1",
			},
		},
	}

	wormholeMessage, err := transferEvent.ToWormholeMessage()
	assert.Nil(t, err)
	assert.Equal(t, wormholeMessage.senderId.ToHex(), "deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07")
	assert.Equal(t, wormholeMessage.nonce, uint32(506497433))
	assert.Equal(t, wormholeMessage.payload, decodeHex("010000000000000000000000000000000000000000000000004563918244f400009fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab00ff0000000000000000000000000d0f183465284cb5cb426902445860456ed59b34000200000000000000000000000000000000000000000000000000005af3107a40004244dbdc1b82dd39336865f969c8d02f75642aed3ae2718dcb3256ceca8b7634"))
	assert.Equal(t, wormholeMessage.Sequence, uint64(101))
	assert.Equal(t, wormholeMessage.consistencyLevel, uint8(1))
	assert.True(t, wormholeMessage.isTransferMessage())

	transferMessage := TransferMessageFromBytes(wormholeMessage.payload)
	amount, succeed := new(big.Int).SetString("5000000000000000000", 10)
	assert.True(t, succeed)
	assert.Equal(t, transferMessage.amount, *amount)
	assert.Equal(t, transferMessage.tokenId.ToHex(), "9fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab")
	assert.Equal(t, transferMessage.tokenChainId, uint16(vaa.ChainIDAlephium))
	assert.Equal(t, transferMessage.toAddress.ToHex(), "0000000000000000000000000d0f183465284cb5cb426902445860456ed59b34")
	assert.Equal(t, transferMessage.toChainId, uint16(vaa.ChainIDEthereum))
	fee, succeed := new(big.Int).SetString("100000000000000", 10)
	assert.True(t, succeed)
	assert.Equal(t, transferMessage.fee, *fee)
	assert.Equal(t, transferMessage.tokenWrapperId.ToHex(), "4244dbdc1b82dd39336865f969c8d02f75642aed3ae2718dcb3256ceca8b7634")
}

func TestValidateUndoneSequencesRemovedEvents(t *testing.T) {
	db, err := Open(t.TempDir())
	assert.Nil(t, err)
	defer db.Close()

	watcher := &Watcher{db: db}
	remoteChainId := uint16(2)
	removedSequences := []uint64{1, 3, 5, 8}

	remoteChainIdGetter := func(tokenBridgeForChainId Byte32) (*uint16, error) {
		return &remoteChainId, nil
	}

	var encodedSequences []byte
	for _, seq := range removedSequences {
		encodedSequences = append(encodedSequences, Uint64ToBytes(seq)...)
	}

	skipIfError, err := watcher.validateUndoneSequencesRemovedEvents(&undoneSequencesRemoved{
		senderId:  randomByte32(),
		sequences: encodedSequences,
	}, remoteChainIdGetter)
	assert.False(t, skipIfError)
	assert.Nil(t, err)
	for _, seq := range removedSequences {
		status, err := watcher.db.getUndoneSequence(remoteChainId, seq)
		assert.Nil(t, err)
		assert.Equal(t, status, []byte{sequenceInit})
	}

	remoteChainIdGetter = func(tokenBridgeForChainId Byte32) (*uint16, error) {
		return nil, errors.New("error")
	}
	invalidSequences := uint64(10)
	skipIfError, err = watcher.validateUndoneSequencesRemovedEvents(&undoneSequencesRemoved{
		senderId:  randomByte32(),
		sequences: Uint64ToBytes(invalidSequences),
	}, remoteChainIdGetter)
	assert.True(t, skipIfError)
	assert.NotNil(t, err)
}

func TestValidateUndoneSequenceCompletedEvents(t *testing.T) {
	db, err := Open(t.TempDir())
	assert.Nil(t, err)
	defer db.Close()

	watcher := &Watcher{
		db: db,
	}
	remoteChainId := uint16(2)
	sequence := uint64(0)

	skipIfError, err := watcher.validateUndoneSequenceCompletedEvents(&undoneSequenceCompleted{
		senderId:      watcher.tokenBridgeContractId,
		remoteChainId: remoteChainId,
		sequence:      sequence,
	})
	assert.False(t, skipIfError)
	assert.NotNil(t, err)

	err = watcher.db.addUndoneSequence(remoteChainId, sequence)
	assert.Nil(t, err)

	skipIfError, err = watcher.validateUndoneSequenceCompletedEvents(&undoneSequenceCompleted{
		senderId:      watcher.tokenBridgeContractId,
		remoteChainId: remoteChainId,
		sequence:      sequence,
	})
	assert.False(t, skipIfError)
	assert.Nil(t, err)

	err = watcher.db.SetSequenceExecuting(remoteChainId, sequence)
	assert.NotNil(t, err)

	skipIfError, err = watcher.validateUndoneSequenceCompletedEvents(&undoneSequenceCompleted{
		senderId:      watcher.tokenBridgeContractId,
		remoteChainId: remoteChainId,
		sequence:      sequence,
	})
	assert.False(t, skipIfError)
	assert.Nil(t, err)

	skipIfError, err = watcher.validateUndoneSequenceCompletedEvents(&undoneSequenceCompleted{
		senderId:      randomByte32(),
		remoteChainId: remoteChainId,
		sequence:      sequence + 1,
	})
	assert.True(t, skipIfError)
	assert.NotNil(t, err)
}

func TestValidateTransferMessages(t *testing.T) {
	watcher := &Watcher{
		msgChan:               make(chan *common.MessagePublication, 4),
		tokenBridgeContractId: randomByte32(),
		contractIdToChainId:   make(map[Byte32]vaa.ChainID),
		chainIdToContractId:   make(map[vaa.ChainID]Byte32),
	}
	watcher.initSupportedChains()

	remoteChainId := uint16(vaa.ChainIDEthereum)
	localChainId := uint16(3)
	localTokenId := randomByte32()
	localTokenWrapperId, err := watcher.getTokenWrapperId(remoteChainId, localTokenId)
	assert.Nil(t, err)

	remoteTokenId := randomByte32()
	remoteTokenWrapperId, err := watcher.getTokenWrapperId(remoteChainId, remoteTokenId)
	assert.Nil(t, err)

	transferMessage := &TransferMessage{
		amount:         *big.NewInt(1),
		tokenId:        localTokenId,
		tokenChainId:   localChainId,
		toAddress:      randomByte32(),
		toChainId:      remoteChainId,
		fee:            *big.NewInt(1),
		tokenWrapperId: *localTokenWrapperId,
	}
	skipIfError, err := watcher.validateTransferMessage(transferMessage)
	assert.False(t, skipIfError)
	assert.Nil(t, err)

	transferMessage.tokenWrapperId = randomByte32()
	skipIfError, err = watcher.validateTransferMessage(transferMessage)
	assert.True(t, skipIfError)
	assert.NotNil(t, err)

	transferMessage = &TransferMessage{
		amount:         *big.NewInt(1),
		tokenId:        remoteTokenId,
		tokenChainId:   remoteChainId,
		toAddress:      randomByte32(),
		toChainId:      remoteChainId,
		fee:            *big.NewInt(1),
		tokenWrapperId: *remoteTokenWrapperId,
	}
	skipIfError, err = watcher.validateTransferMessage(transferMessage)
	assert.False(t, skipIfError)
	assert.Nil(t, err)

	transferMessage.tokenWrapperId = randomByte32()
	skipIfError, err = watcher.validateTransferMessage(transferMessage)
	assert.True(t, skipIfError)
	assert.NotNil(t, err)
}

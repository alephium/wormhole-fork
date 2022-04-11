package alephium

import (
	"context"
	"encoding/hex"
	"math/big"
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"github.com/go-test/deep"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
)

func decodeHex(str string) []byte {
	bytes, err := hex.DecodeString(str)
	assume(err == nil)
	return bytes
}

func TestAttestEvent(t *testing.T) {
	attestTokenEvent := &Event{
		BlockHash:       randomByte32().ToHex(),
		ContractAddress: "y9dvJcZAQUjgx3hL5ZGwvT488cpdpy7N6TDSK7Vk8TWs",
		TxId:            randomByte32().ToHex(),
		Index:           0,
		Fields: []*Field{
			{ // sender
				Type:  "ByteVec",
				Value: "deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07",
			},
			{ // sequence
				Type:  "U256",
				Value: "100",
			},
			{ // data
				Type:  "ByteVec",
				Value: "12e551d9029fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab000d0800000000000000000000000000000000000000000000746573742d746f6b656e00000000000000000000000000000000000000000000746573742d746f6b656e",
			},
			{ // consistencyLevel
				Type:  "U256",
				Value: "0",
			},
		},
	}

	wormholeMessage, err := WormholeMessageFromEvent(attestTokenEvent)
	assert.Nil(t, err)
	assert.Equal(t, wormholeMessage.emitter.ToHex(), "deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07")
	assert.Equal(t, wormholeMessage.nonce, uint32(317018585))
	assert.Equal(t, wormholeMessage.payload, decodeHex("029fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab000d0800000000000000000000000000000000000000000000746573742d746f6b656e00000000000000000000000000000000000000000000746573742d746f6b656e"))
	assert.Equal(t, wormholeMessage.sequence, uint64(100))
	assert.Equal(t, wormholeMessage.consistencyLevel, uint8(0))
	assert.False(t, wormholeMessage.isTransferMessage())
}

func TestTransferEvent(t *testing.T) {
	transferEvent := &Event{
		BlockHash:       randomByte32().ToHex(),
		ContractAddress: "y9dvJcZAQUjgx3hL5ZGwvT488cpdpy7N6TDSK7Vk8TWs",
		TxId:            randomByte32().ToHex(),
		Index:           0,
		Fields: []*Field{
			{ // sender
				Type:  "ByteVec",
				Value: "deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07",
			},
			{ // sequence
				Type:  "U256",
				Value: "101",
			},
			{ // data
				Type:  "ByteVec",
				Value: "1e308999010000000000000000000000000000000000000000000000004563918244f400009fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab000d0000000000000000000000000d0f183465284cb5cb426902445860456ed59b34000200000000000000000000000000000000000000000000000000005af3107a4000014244dbdc1b82dd39336865f969c8d02f75642aed3ae2718dcb3256ceca8b7634",
			},
			{ // consistencyLevel
				Type:  "U256",
				Value: "1",
			},
		},
	}

	wormholeMessage, err := WormholeMessageFromEvent(transferEvent)
	assert.Nil(t, err)
	assert.Equal(t, wormholeMessage.emitter.ToHex(), "deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07")
	assert.Equal(t, wormholeMessage.nonce, uint32(506497433))
	assert.Equal(t, wormholeMessage.payload, decodeHex("010000000000000000000000000000000000000000000000004563918244f400009fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab000d0000000000000000000000000d0f183465284cb5cb426902445860456ed59b34000200000000000000000000000000000000000000000000000000005af3107a4000014244dbdc1b82dd39336865f969c8d02f75642aed3ae2718dcb3256ceca8b7634"))
	assert.Equal(t, wormholeMessage.sequence, uint64(101))
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
	assert.True(t, transferMessage.isLocalToken)
	assert.Equal(t, transferMessage.senderId.ToHex(), "4244dbdc1b82dd39336865f969c8d02f75642aed3ae2718dcb3256ceca8b7634")
}

func TestValidateTokenWrapperEvents(t *testing.T) {
	db, err := Open(t.TempDir())
	assert.Nil(t, err)
	defer db.Close()

	watcher := &Watcher{
		chainIndex: &ChainIndex{
			FromGroup: 0,
			ToGroup:   0,
		},
		db:                       db,
		tokenBridgeForChainCache: sync.Map{},
		localTokenWrapperCache:   sync.Map{},
		remoteTokenWrapperCache:  sync.Map{},
	}

	tokenWrapperAddresses := []string{randomAddress(), randomAddress()}
	toUnconfirmedEvent := func(address string) *UnconfirmedEvent {
		return &UnconfirmedEvent{
			event: &Event{
				Fields: []*Field{
					{
						Type:  "Address",
						Value: address,
					},
				},
			},
		}
	}
	var confirmedEvents ConfirmedEvents
	for _, address := range tokenWrapperAddresses {
		confirmedEvents.events = append(confirmedEvents.events, toUnconfirmedEvent(address))
	}
	confirmedEvents.events[0].eventIndex = 3
	confirmedEvents.events[1].eventIndex = 2

	remoteChainId := uint16(2)
	tokenBridgeForChainId := randomByte32()
	err = db.addRemoteChain(remoteChainId, toContractAddress(tokenBridgeForChainId))
	assert.Nil(t, err)

	localTokenId := randomByte32()
	remoteTokenId := randomByte32()

	tokenWrapperInfoGetter := func(address string) (*tokenWrapperInfo, error) {
		info := &tokenWrapperInfo{
			tokenBridgeForChainId: tokenBridgeForChainId,
			remoteChainId:         remoteChainId,
		}

		if address == tokenWrapperAddresses[0] {
			info.isLocalToken = true
			info.tokenId = localTokenId
			info.tokenWrapperAddress = tokenWrapperAddresses[0]
			info.tokenWrapperId = toContractId(tokenWrapperAddresses[0])
			return info, nil
		}
		if address == tokenWrapperAddresses[1] {
			info.isLocalToken = false
			info.tokenId = remoteTokenId
			info.tokenWrapperAddress = tokenWrapperAddresses[1]
			info.tokenWrapperId = toContractId(tokenWrapperAddresses[1])
			return info, nil
		}
		return nil, nil
	}

	ctx := context.Background()
	logger, err := zap.NewProduction()
	assert.Nil(t, err)
	err = watcher.validateTokenWrapperEvents(ctx, logger, &confirmedEvents, tokenWrapperInfoGetter)
	assert.Nil(t, err)

	checkEventIndex := func(expectedIndex uint64) {
		eventIndex, err := db.getLastTokenWrapperFactoryEventIndex()
		assert.Nil(t, err)
		assert.Equal(t, *eventIndex, expectedIndex)
	}

	checkEventIndex(3)

	// check local token wrapper
	localTokenWrapperKey := LocalTokenWrapperKey{
		remoteChainId: remoteChainId,
		localTokenId:  localTokenId,
	}
	localTokenWrapperAddress, err := db.GetLocalTokenWrapper(localTokenId, remoteChainId)
	assert.Nil(t, err)
	assert.Equal(t, localTokenWrapperAddress, tokenWrapperAddresses[0])
	localTokenWrapperId, ok := watcher.localTokenWrapperCache.Load(localTokenWrapperKey)
	assert.True(t, ok)
	assert.Equal(t, *localTokenWrapperId.(*Byte32), toContractId(tokenWrapperAddresses[0]))

	// check remote token wrapper
	remoteTokenWrapperAddress, err := db.GetRemoteTokenWrapper(remoteTokenId)
	assert.Nil(t, err)
	assert.Equal(t, remoteTokenWrapperAddress, tokenWrapperAddresses[1])
	remoteTokenWrapperId, ok := watcher.remoteTokenWrapperCache.Load(remoteTokenId)
	assert.True(t, ok)
	assert.Equal(t, *remoteTokenWrapperId.(*Byte32), toContractId(tokenWrapperAddresses[1]))

	// token bridge for chain does not exist
	invalidTokenWrapperAddress := randomAddress()
	invalidInfo := &tokenWrapperInfo{
		tokenBridgeForChainId: tokenBridgeForChainId,
		remoteChainId:         remoteChainId + 1,
		isLocalToken:          true,
		tokenId:               randomByte32(),
		tokenWrapperAddress:   invalidTokenWrapperAddress,
		tokenWrapperId:        toContractId(invalidTokenWrapperAddress),
	}
	ignoreInvalidEvent := func(info *tokenWrapperInfo, index uint64) {
		checkEventIndex(index)
		invalidTokenWrapperKey := LocalTokenWrapperKey{
			remoteChainId: invalidInfo.remoteChainId,
			localTokenId:  invalidInfo.tokenId,
		}
		_, ok = watcher.localTokenWrapperCache.Load(invalidTokenWrapperKey)
		assert.False(t, ok)
	}
	tokenWrapperInfoGetter = func(address string) (*tokenWrapperInfo, error) {
		return invalidInfo, err
	}
	confirmedEvents = ConfirmedEvents{
		events: []*UnconfirmedEvent{toUnconfirmedEvent(invalidTokenWrapperAddress)},
	}
	confirmedEvents.events[0].eventIndex = 4
	err = watcher.validateTokenWrapperEvents(ctx, logger, &confirmedEvents, tokenWrapperInfoGetter)
	assert.Nil(t, err)
	ignoreInvalidEvent(invalidInfo, 4)

	// invalid sender contract id
	invalidInfo.tokenBridgeForChainId = randomByte32()
	invalidInfo.remoteChainId = remoteChainId
	confirmedEvents.events[0].eventIndex = 5
	err = watcher.validateTokenWrapperEvents(ctx, logger, &confirmedEvents, tokenWrapperInfoGetter)
	assert.Nil(t, err)
	ignoreInvalidEvent(invalidInfo, 5)

	// local token wrapper already exist
	invalidInfo.tokenBridgeForChainId = tokenBridgeForChainId
	invalidInfo.tokenId = localTokenId
	confirmedEvents.events[0].eventIndex = 6
	err = watcher.validateTokenWrapperEvents(ctx, logger, &confirmedEvents, tokenWrapperInfoGetter)
	assert.Nil(t, err)

	checkEventIndex(6)
	contractId, ok := watcher.localTokenWrapperCache.Load(localTokenWrapperKey)
	assert.True(t, ok)
	assert.Equal(t, contractId, localTokenWrapperId)
}

func TestValidateGovernanceEvents(t *testing.T) {
	db, err := Open(t.TempDir())
	assert.Nil(t, err)
	defer db.Close()

	logger, err := zap.NewProduction()
	assert.Nil(t, err)

	watcher := &Watcher{
		db:                      db,
		localTokenWrapperCache:  sync.Map{},
		remoteTokenWrapperCache: sync.Map{},
		msgChan:                 make(chan *common.MessagePublication, 4),
		tokenBridgeContract:     randomAddress(),
	}

	remoteChainId := uint16(2)
	localChainId := uint16(3)
	localTokenId := randomByte32()
	localTokenWrapperAddress := randomAddress()
	localTokenWrapperId := toContractId(localTokenWrapperAddress)
	remoteTokenId := randomByte32()
	remoteTokenWrapperAddress := randomAddress()
	remoteTokenWrapperId := toContractId(remoteTokenWrapperAddress)

	err = db.addLocalTokenWrapper(localTokenId, remoteChainId, localTokenWrapperAddress)
	assert.Nil(t, err)
	err = db.addRemoteTokenWrapper(remoteTokenId, remoteTokenWrapperAddress)
	assert.Nil(t, err)

	received := func() *common.MessagePublication {
		timer := time.NewTimer(200 * time.Millisecond)
		defer timer.Stop()

		select {
		case msg := <-watcher.msgChan:
			return msg
		case <-timer.C:
			return nil
		}
	}

	tokenBridgeContractId := toContractId(watcher.tokenBridgeContract)
	test := func(transferMsg *TransferMessage) {
		unconfirmedEvent := &UnconfirmedEvent{
			blockHeader: &BlockHeader{},
			event: &Event{
				Fields: []*Field{
					fieldFromByte32(tokenBridgeContractId),
					fieldFromBigInt(big.NewInt(1)),
					fieldFromByteVec(randomBytes(4)),
					fieldFromByteVec(transferMsg.encode()),
					fieldFromBigInt(big.NewInt(0)),
				},
			},
		}
		confirmedEvents := &ConfirmedEvents{events: []*UnconfirmedEvent{unconfirmedEvent}}
		err = watcher.validateGovernanceEvents(logger, confirmedEvents)
		assert.Nil(t, err)
		wormholeMsg, err := WormholeMessageFromEvent(confirmedEvents.events[0].event)
		assert.Nil(t, err)
		diff := deep.Equal(*received(), *wormholeMsg.toMessagePublication(&BlockHeader{}))
		assert.Nil(t, diff)

		confirmedEvents.events[0].event.Fields[0] = fieldFromByte32(randomByte32())
		err = watcher.validateGovernanceEvents(logger, confirmedEvents)
		assert.Nil(t, err)
		assert.Nil(t, received())

		confirmedEvents.events[0].event.Fields[0] = fieldFromByte32(tokenBridgeContractId)
		transferMsg.senderId = randomByte32()
		confirmedEvents.events[0].event.Fields[3] = fieldFromByteVec(transferMsg.encode())
		err = watcher.validateGovernanceEvents(logger, confirmedEvents)
		assert.Nil(t, err)
		assert.Nil(t, received())
	}

	// transfer local token message
	test(&TransferMessage{
		amount:       *big.NewInt(10),
		tokenId:      localTokenId,
		tokenChainId: localChainId,
		toAddress:    randomByte32(),
		toChainId:    remoteChainId,
		fee:          *big.NewInt(1),
		isLocalToken: true,
		senderId:     localTokenWrapperId,
	})

	// transfer remote token message
	test(&TransferMessage{
		amount:       *big.NewInt(10),
		tokenId:      remoteTokenId,
		tokenChainId: remoteChainId,
		toAddress:    randomByte32(),
		toChainId:    remoteChainId,
		fee:          *big.NewInt(1),
		isLocalToken: false,
		senderId:     remoteTokenWrapperId,
	})

	// non-transfer message
	unconfirmedEvent := &UnconfirmedEvent{
		blockHeader: &BlockHeader{},
		event: &Event{
			Fields: []*Field{
				fieldFromByte32(tokenBridgeContractId),
				fieldFromBigInt(big.NewInt(1)),
				fieldFromByteVec(randomBytes(4)),
				fieldFromByteVec([]byte{100, 10}),
				fieldFromBigInt(big.NewInt(0)),
			},
		},
	}
	confirmedEvents := &ConfirmedEvents{events: []*UnconfirmedEvent{unconfirmedEvent}}
	err = watcher.validateGovernanceEvents(logger, confirmedEvents)
	assert.Nil(t, err)
	wormholeMsg, err := WormholeMessageFromEvent(confirmedEvents.events[0].event)
	assert.Nil(t, err)
	diff := deep.Equal(*received(), *wormholeMsg.toMessagePublication(&BlockHeader{}))
	assert.Nil(t, diff)
}

func randomBytes(length int) []byte {
	data := make([]byte, length)
	size, err := rand.Read(data)
	assume(size == length)
	assume(err == nil)
	return data
}

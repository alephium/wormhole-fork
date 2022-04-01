package alephium

import (
	"encoding/hex"
	"math/big"
	"testing"

	"github.com/certusone/wormhole/node/pkg/vaa"
	"github.com/stretchr/testify/assert"
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

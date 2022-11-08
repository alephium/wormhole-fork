package vaa

import (
	"bytes"
	"encoding/binary"

	"github.com/ethereum/go-ethereum/common"
)

// CoreModule is the identifier of the Core module (which is used for governance messages)
var CoreModule = []byte{00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 0x43, 0x6f, 0x72, 0x65}

// 000000000000000000000000000000000000000000546f6b656e427269646765
var TokenBridgeModule = []byte{00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 00, 0x54, 0x6f, 0x6b, 0x65, 0x6e, 0x42, 0x72, 0x69, 0x64, 0x67, 0x65}

type (
	// BodyUpdateMessageFee is a governance message to perform update message fee of the core module
	BodyUpdateMessageFee struct {
		NewMessageFee []byte
	}

	BodyTransferFee struct {
		Amount    []byte
		Recipient []byte
	}

	// BodyContractUpgrade is a governance message to perform a contract upgrade of the core module
	BodyContractUpgrade struct {
		Payload []byte
	}

	// BodyGuardianSetUpgrade is a governance message to set a new guardian set
	BodyGuardianSetUpgrade struct {
		Keys     []common.Address
		NewIndex uint32
	}

	// BodyTokenBridgeRegisterChain is a governance message to register a chain on the token bridge
	BodyTokenBridgeRegisterChain struct {
		Module         string
		ChainID        ChainID
		EmitterAddress Address
	}

	// BodyTokenBridgeUpgradeContract is a governance message to upgrade the token bridge.
	BodyTokenBridgeUpgradeContract struct {
		Module  string
		Payload []byte
	}

	BodyTokenBridgeDestroyContracts struct {
		EmitterChain ChainID
		Sequences    []uint64
	}

	BodyTokenBridgeUpdateMinimalConsistencyLevel struct {
		NewConsistencyLevel uint8
	}

	BodyTokenBridgeUpdateRefundAddress struct {
		NewRefundAddress []byte
	}
)

func (b BodyUpdateMessageFee) Serialize() []byte {
	buf := new(bytes.Buffer)

	// Module
	buf.Write(CoreModule)
	// Action
	MustWrite(buf, binary.BigEndian, uint8(3))
	buf.Write(b.NewMessageFee)
	return buf.Bytes()
}

func (b BodyTransferFee) Serialize() []byte {
	buf := new(bytes.Buffer)

	// Module
	buf.Write(CoreModule)
	// Action
	MustWrite(buf, binary.BigEndian, uint8(4))
	buf.Write(b.Amount)
	buf.Write(b.Recipient)
	return buf.Bytes()
}

func (b BodyContractUpgrade) Serialize() []byte {
	buf := new(bytes.Buffer)

	// Module
	buf.Write(CoreModule)
	// Action
	MustWrite(buf, binary.BigEndian, uint8(1))

	buf.Write(b.Payload[:])

	return buf.Bytes()
}

func (b BodyGuardianSetUpgrade) Serialize() []byte {
	buf := new(bytes.Buffer)

	// Module
	buf.Write(CoreModule)
	// Action
	MustWrite(buf, binary.BigEndian, uint8(2))
	// ChainID - 0 for universal
	MustWrite(buf, binary.BigEndian, uint16(0))

	MustWrite(buf, binary.BigEndian, b.NewIndex)
	MustWrite(buf, binary.BigEndian, uint8(len(b.Keys)))
	for _, k := range b.Keys {
		buf.Write(k[:])
	}

	return buf.Bytes()
}

func (r BodyTokenBridgeRegisterChain) Serialize() []byte {
	if len(r.Module) > 32 {
		panic("module longer than 32 byte")
	}

	buf := &bytes.Buffer{}

	// Write token bridge header
	for i := 0; i < (32 - len(r.Module)); i++ {
		buf.WriteByte(0x00)
	}
	buf.Write([]byte(r.Module))
	// Write action ID
	MustWrite(buf, binary.BigEndian, uint8(1))
	// Write target chain (0 = universal)
	MustWrite(buf, binary.BigEndian, uint16(0))
	// Write chain to be registered
	MustWrite(buf, binary.BigEndian, r.ChainID)
	// Write emitter address of chain to be registered
	buf.Write(r.EmitterAddress[:])

	return buf.Bytes()
}

func (r BodyTokenBridgeUpgradeContract) Serialize() []byte {
	if len(r.Module) > 32 {
		panic("module longer than 32 byte")
	}

	buf := &bytes.Buffer{}

	// Write token bridge header
	for i := 0; i < (32 - len(r.Module)); i++ {
		buf.WriteByte(0x00)
	}
	buf.Write([]byte(r.Module))
	// Write action ID
	MustWrite(buf, binary.BigEndian, uint8(2))
	// Write contract upgrade payload
	buf.Write(r.Payload[:])

	return buf.Bytes()
}

func (b BodyTokenBridgeDestroyContracts) Serialize() []byte {
	buf := new(bytes.Buffer)

	// Module
	buf.Write(TokenBridgeModule)
	// Action ID
	MustWrite(buf, binary.BigEndian, uint8(0xf0))
	MustWrite(buf, binary.BigEndian, uint16(b.EmitterChain))
	MustWrite(buf, binary.BigEndian, uint16(len(b.Sequences)))
	for _, seq := range b.Sequences {
		MustWrite(buf, binary.BigEndian, seq)
	}
	return buf.Bytes()
}

func (b BodyTokenBridgeUpdateMinimalConsistencyLevel) Serialize() []byte {
	buf := new(bytes.Buffer)

	// Module
	buf.Write(TokenBridgeModule)
	// Action ID
	MustWrite(buf, binary.BigEndian, uint8(0xf1))
	MustWrite(buf, binary.BigEndian, b.NewConsistencyLevel)
	return buf.Bytes()
}

func (b BodyTokenBridgeUpdateRefundAddress) Serialize() []byte {
	buf := new(bytes.Buffer)

	// Module
	buf.Write(TokenBridgeModule)
	// Action ID
	MustWrite(buf, binary.BigEndian, uint8(0xf2))
	MustWrite(buf, binary.BigEndian, uint16(len(b.NewRefundAddress)))
	buf.Write(b.NewRefundAddress)
	return buf.Bytes()
}

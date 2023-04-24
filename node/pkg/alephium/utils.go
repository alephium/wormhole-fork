package alephium

import (
	"bytes"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"math/big"
	"time"

	sdk "github.com/alephium/go-sdk"
	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/btcsuite/btcutil/base58"
	ethCommon "github.com/ethereum/go-ethereum/common"
)

const HashLength = 32
const WormholeMessageEventIndex = 0
const WormholeMessageFieldSize = 6

func ToContractId(address string) (Byte32, error) {
	var byte32 Byte32
	contractId := base58.Decode(address)
	if len(contractId) != 33 {
		return byte32, fmt.Errorf("invalid contract address %s", address)
	}
	copy(byte32[:], contractId[1:])
	return byte32, nil
}

func ToContractAddress(contractId string) (*string, error) {
	b, err := HexToFixedSizeBytes(contractId, 32)
	if err != nil {
		return nil, err
	}
	bytes := []byte{0x03}
	bytes = append(bytes, b[:]...)
	address := base58.Encode(bytes)
	return &address, nil
}

func HexToByte32(str string) (Byte32, error) {
	var byte32 Byte32
	bytes, err := HexToFixedSizeBytes(str, 32)
	if err != nil {
		return byte32, err
	}
	copy(byte32[:], bytes[:])
	return byte32, nil
}

func HexToFixedSizeBytes(str string, length int) ([]byte, error) {
	if len(str) != length*2 {
		return nil, fmt.Errorf("invalid hex string %s, expect %d bytes", str, length)
	}
	bytes, err := hex.DecodeString(str)
	if err != nil {
		return nil, err
	}
	return bytes, nil
}

type Byte32 [32]byte

func (b Byte32) equalWith(v Byte32) bool {
	return bytes.Equal(b[:], v[:])
}

func (b Byte32) ToHex() string {
	dst := make([]byte, HashLength*2)
	hex.Encode(dst, b[:])
	return string(dst)
}

type ChainIndex struct {
	FromGroup int32
	ToGroup   int32
}

func Uint16ToBytes(value uint16) []byte {
	bytes := make([]byte, 2)
	binary.BigEndian.PutUint16(bytes, value)
	return bytes
}

func Uint64ToBytes(value uint64) []byte {
	bytes := make([]byte, 8)
	binary.BigEndian.PutUint64(bytes, value)
	return bytes
}

type WormholeMessage struct {
	txId             string
	senderId         Byte32
	targetChainId    uint16
	nonce            uint32
	payload          []byte
	Sequence         uint64
	consistencyLevel uint8
}

func (w *WormholeMessage) toMessagePublication(header *sdk.BlockHeaderEntry) *common.MessagePublication {
	second := header.Timestamp / 1000
	milliSecond := header.Timestamp % 1000
	ts := time.Unix(int64(second), int64(milliSecond)*int64(time.Millisecond))
	return &common.MessagePublication{
		TxHash:           ethCommon.HexToHash(w.txId),
		Timestamp:        ts,
		Nonce:            w.nonce,
		Sequence:         w.Sequence,
		ConsistencyLevel: w.consistencyLevel,
		EmitterChain:     vaa.ChainIDAlephium,
		TargetChain:      vaa.ChainID(w.targetChainId),
		EmitterAddress:   vaa.Address(w.senderId),
		Payload:          w.payload,
	}
}

func toBool(field sdk.Val) (*bool, error) {
	if field.ValBool == nil {
		return nil, fmt.Errorf("`ValBool` is nil")
	}
	if field.ValBool.Type != "Bool" {
		return nil, fmt.Errorf("invalid bool type %s", field.ValBool.Type)
	}
	return &field.ValBool.Value, nil
}

func toByteVec(field sdk.Val) ([]byte, error) {
	if field.ValByteVec == nil {
		return nil, fmt.Errorf("`ValByteVec` is nil")
	}
	if field.ValByteVec.Type != "ByteVec" {
		return nil, fmt.Errorf("invalid bytevec type %s", field.ValByteVec.Type)
	}
	return hex.DecodeString(field.ValByteVec.Value)
}

func toAddress(field sdk.Val) (*string, error) {
	if field.ValAddress == nil {
		return nil, fmt.Errorf("`ValAddress` is nil")
	}
	if field.ValAddress.Type != "Address" {
		return nil, fmt.Errorf("invalid address type %s", field.ValAddress.Type)
	}
	return &field.ValAddress.Value, nil
}

func toByte32(field sdk.Val) (*Byte32, error) {
	bytes, err := toByteVec(field)
	if err != nil {
		return nil, err
	}
	if len(bytes) != 32 {
		return nil, errors.New("invalid byte32")
	}
	var byte32 Byte32
	copy(byte32[:], bytes)
	return &byte32, nil
}

func toU256(field sdk.Val) (*big.Int, error) {
	if field.ValU256 == nil {
		return nil, fmt.Errorf("`ValU256` is nil")
	}
	if field.ValU256.Type != "U256" {
		return nil, fmt.Errorf("invalid u256 type %s", field.ValU256.Type)
	}
	num, succeed := new(big.Int).SetString(field.ValU256.Value, 10)
	if !succeed {
		return nil, fmt.Errorf("invalid u256 value %s", field.ValU256.Value)
	}
	return num, nil
}

func toI256(field sdk.Val) (*big.Int, error) {
	if field.ValI256 == nil {
		return nil, fmt.Errorf("`ValI256` is nil")
	}
	if field.ValI256.Type != "I256" {
		return nil, fmt.Errorf("invalid i256 type %s", field.ValI256.Type)
	}
	num, succeed := new(big.Int).SetString(field.ValI256.Value, 10)
	if !succeed {
		return nil, fmt.Errorf("invalid i256 value %s", field.ValI256.Value)
	}
	return num, nil
}

func toUint64(field sdk.Val) (*uint64, error) {
	bigInt, err := toU256(field)
	if err != nil {
		return nil, err
	}
	if bigInt.IsUint64() {
		v := bigInt.Uint64()
		return &v, nil
	}
	return nil, errors.New("invalid uint64")
}

func toUint8(field sdk.Val) (*uint8, error) {
	value, err := toU256(field)
	if err != nil {
		return nil, err
	}
	if value.Cmp(big.NewInt(math.MaxUint8)) < 0 {
		v := uint8(value.Uint64())
		return &v, nil
	}
	return nil, errors.New("invalid uint8")
}

func toUint16(field sdk.Val) (*uint16, error) {
	value, err := toU256(field)
	if err != nil {
		return nil, err
	}
	if value.Cmp(big.NewInt(math.MaxUint16)) < 0 {
		v := uint16(value.Uint64())
		return &v, nil
	}
	return nil, errors.New("invalid uint16")
}

func maxUint8(a, b uint8) uint8 {
	if a > b {
		return a
	}
	return b
}

func ToWormholeMessage(fields []sdk.Val, txId string) (*WormholeMessage, error) {
	if len(fields) != WormholeMessageFieldSize {
		return nil, fmt.Errorf("invalid wormhole message field size, expect %d, have %d", WormholeMessageFieldSize, len(fields))
	}
	emitter, err := toByte32(fields[0])
	if err != nil {
		return nil, err
	}

	targetChainId, err := toUint16(fields[1])
	if err != nil {
		return nil, err
	}

	sequence, err := toUint64(fields[2])
	if err != nil {
		return nil, err
	}

	nonceBytes, err := toByteVec(fields[3])
	if err != nil {
		return nil, err
	}
	if len(nonceBytes) != 4 {
		return nil, fmt.Errorf("invalid nonce size")
	}

	nonce := binary.BigEndian.Uint32(nonceBytes)
	payload, err := toByteVec(fields[4])
	if err != nil {
		return nil, err
	}

	consistencyLevel, err := toUint8(fields[5])
	if err != nil {
		return nil, err
	}
	return &WormholeMessage{
		txId:             txId,
		senderId:         *emitter,
		targetChainId:    *targetChainId,
		nonce:            nonce,
		payload:          payload,
		Sequence:         *sequence,
		consistencyLevel: *consistencyLevel,
	}, nil
}

func marshalContractEvent(event *sdk.ContractEvent) string {
	result, _ := json.Marshal(event)
	return string(result)
}

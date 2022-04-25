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
	"runtime/debug"
	"time"

	"github.com/btcsuite/btcutil/base58"
	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/vaa"
	ethCommon "github.com/ethereum/go-ethereum/common"
)

const HashLength = 32
const transferPayloadId byte = 1
const (
	WormholeMessageEventIndex            = 0
	TokenBridgeForChainCreatedEventIndex = 1
	TokenWrapperCreatedEventIndex        = 2
	UndoneSequencesRemovedEventIndex     = 3
	UndoneSequenceCompletedEventIndex    = 4
)

func assume(cond bool) {
	if !cond {
		debug.PrintStack()
		panic(cond)
	}
}

func ToContractId(address string) (Byte32, error) {
	var byte32 Byte32
	contractId := base58.Decode(address)
	if len(contractId) != 33 {
		return byte32, fmt.Errorf("invalid contract address %s", address)
	}
	assume(len(contractId) == 33)
	copy(byte32[:], contractId[1:])
	return byte32, nil
}

func ToContractAddress(id Byte32) string {
	bytes := []byte{0x03}
	bytes = append(bytes, id[:]...)
	return base58.Encode(bytes)
}

func toContractId(address string) Byte32 {
	contractId, err := ToContractId(address)
	assume(err == nil)
	return contractId
}

type Hash [HashLength]byte

func (h Hash) ToHex() string {
	dst := make([]byte, HashLength*2)
	hex.Encode(dst, h[:])
	return string(dst)
}

func (h Hash) Bytes() []byte {
	return h[:]
}

func HexToFixedSizeBytes(str string, length int) []byte {
	assume(len(str) == length*2)
	bytes, err := hex.DecodeString(str)
	assume(err == nil)
	return bytes
}

func HexToBytes(str string) []byte {
	assume(len(str)&1 == 0)
	bytes, err := hex.DecodeString(str)
	assume(err == nil)
	return bytes
}

func HexToHash(str string) Hash {
	var hash Hash
	copy(hash[:], HexToFixedSizeBytes(str, 32))
	return hash
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

func HexToByte32(str string) Byte32 {
	var result Byte32
	copy(result[:], HexToFixedSizeBytes(str, 32))
	return result
}

type ChainIndex struct {
	FromGroup uint8
	ToGroup   uint8
}

type Field struct {
	Type  string      `json:"type"`
	Value interface{} `json:"value"` // we have to use `interface{}` here
}

func (f *Field) ToBool() bool {
	assume(f.Type == "Bool")
	return f.Value.(bool)
}

func (f *Field) toBigInt() *big.Int {
	num, succeed := new(big.Int).SetString(f.Value.(string), 10)
	assume(succeed)
	return num
}

func (f *Field) ToU256() *big.Int {
	assume(f.Type == "U256")
	return f.toBigInt()
}

func fieldFromBigInt(num *big.Int) *Field {
	assume(num.Sign() >= 0)
	var byte32 Byte32
	num.FillBytes(byte32[:])
	return &Field{
		Type:  "U256",
		Value: byte32.ToHex(),
	}
}

func (f *Field) ToI256() *big.Int {
	assume(f.Type == "I256")
	return f.toBigInt()
}

func (f *Field) ToByteVec() []byte {
	assume(f.Type == "ByteVec")
	return HexToBytes(f.Value.(string))
}

func (f *Field) ToByte32() (*Byte32, error) {
	bytes := f.ToByteVec()
	if len(bytes) != 32 {
		return nil, errors.New("invalid byte32")
	}
	var byte32 Byte32
	copy(byte32[:], bytes)
	return &byte32, nil
}

func (f *Field) ToAddress() string {
	assume(f.Type == "Address")
	return f.Value.(string)
}

func (f *Field) ToUint64() (uint64, error) {
	bigInt := f.ToU256()
	if bigInt.IsUint64() {
		return bigInt.Uint64(), nil
	}
	return 0, errors.New("invalid uint64")
}

func (f *Field) ToUint16() (uint16, error) {
	bigInt := f.ToU256()
	if bigInt.Cmp(big.NewInt(math.MaxUint16)) < 0 {
		return uint16(bigInt.Uint64()), nil
	}
	return 0, errors.New("invalid uint16")
}

func (f *Field) ToUint8() (uint8, error) {
	bigInt := f.ToU256()
	if bigInt.Cmp(big.NewInt(math.MaxUint8)) < 0 {
		return uint8(bigInt.Uint64()), nil
	}
	return 0, errors.New("invalid uint8")
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
	event            *Event
	senderId         Byte32
	nonce            uint32
	payload          []byte
	Sequence         uint64
	consistencyLevel uint8
}

func (w *WormholeMessage) isTransferMessage() bool {
	return w.payload[0] == transferPayloadId
}

func (w *WormholeMessage) toMessagePublication(header *BlockHeader) *common.MessagePublication {
	second := header.Timestamp / 1000
	milliSecond := header.Timestamp % 1000
	ts := time.Unix(int64(second), int64(milliSecond)*int64(time.Millisecond))

	payload := w.payload
	if w.isTransferMessage() {
		// remove the last 33 bytes from transfer message payload
		payload = w.payload[0 : len(w.payload)-33]
	}

	return &common.MessagePublication{
		TxHash:           ethCommon.HexToHash(w.event.TxId),
		Timestamp:        ts,
		Nonce:            w.nonce,
		Sequence:         w.Sequence,
		ConsistencyLevel: w.consistencyLevel,
		EmitterChain:     vaa.ChainIDAlephium,
		EmitterAddress:   vaa.Address(w.senderId),
		Payload:          payload,
	}
}

// published message from alephium bridge contract
type TransferMessage struct {
	amount         big.Int
	tokenId        Byte32
	tokenChainId   uint16
	toAddress      Byte32
	toChainId      uint16
	fee            big.Int
	isLocalToken   bool
	tokenWrapperId Byte32
}

func readBigInt(reader *bytes.Reader, num *big.Int) {
	var byte32 Byte32
	size, err := reader.Read(byte32[:])
	assume(size == 32)
	assume(err == nil)
	num.SetBytes(byte32[:])
}

func readUint16(reader *bytes.Reader, num *uint16) {
	err := binary.Read(reader, binary.BigEndian, num)
	assume(err == nil)
}

func readByte32(reader *bytes.Reader, byte32 *Byte32) {
	size, err := reader.Read(byte32[:])
	assume(size == 32)
	assume(err == nil)
}

func readBool(reader *bytes.Reader) bool {
	b, err := reader.ReadByte()
	assume(err == nil)
	return b == 1
}

func TransferMessageFromBytes(data []byte) *TransferMessage {
	assume(data[0] == transferPayloadId)
	reader := bytes.NewReader(data[1:]) // skip the payloadId
	var message TransferMessage
	readBigInt(reader, &message.amount)
	readByte32(reader, &message.tokenId)
	readUint16(reader, &message.tokenChainId)
	readByte32(reader, &message.toAddress)
	readUint16(reader, &message.toChainId)
	readBigInt(reader, &message.fee)
	message.isLocalToken = readBool(reader)
	readByte32(reader, &message.tokenWrapperId)
	return &message
}

type tokenWrapperCreated struct {
	senderId              Byte32
	tokenBridgeForChainId Byte32
	tokenWrapperId        Byte32
	isLocalToken          bool
	tokenId               Byte32
	remoteChainId         uint16
}

type tokenBridgeForChainCreated struct {
	senderId      Byte32
	contractId    Byte32
	remoteChainId uint16
}

type undoneSequencesRemoved struct {
	senderId  Byte32
	sequences []byte
}

type undoneSequenceCompleted struct {
	senderId      Byte32
	remoteChainId uint16
	sequence      uint64
}

type Event struct {
	BlockHash       string   `json:"blockHash"`
	ContractAddress string   `json:"contractAddress"`
	TxId            string   `json:"txId"`
	Index           int32    `json:"index"`
	Fields          []*Field `json:"fields"`
}

func (e *Event) ToString() string {
	data, _ := json.Marshal(e)
	return string(data)
}

func (e *Event) ToWormholeMessage() (*WormholeMessage, error) {
	assume(len(e.Fields) == 5)
	emitter, err := e.Fields[0].ToByte32()
	if err != nil {
		return nil, err
	}
	sequence, err := e.Fields[1].ToUint64()
	if err != nil {
		return nil, err
	}
	nonceBytes := e.Fields[2].ToByteVec()
	if len(nonceBytes) != 4 {
		return nil, fmt.Errorf("invalid nonce size")
	}
	nonce := binary.BigEndian.Uint32(nonceBytes)
	payload := e.Fields[3].ToByteVec()
	consistencyLevel, err := e.Fields[4].ToUint8()
	if err != nil {
		return nil, err
	}
	return &WormholeMessage{
		event:            e,
		senderId:         *emitter,
		nonce:            nonce,
		payload:          payload,
		Sequence:         sequence,
		consistencyLevel: consistencyLevel,
	}, nil
}

func (e *Event) toUndoneSequencesRemoved() (*undoneSequencesRemoved, error) {
	assume(len(e.Fields) == 2)
	senderId, err := e.Fields[0].ToByte32()
	if err != nil {
		return nil, err
	}
	sequences := e.Fields[1].ToByteVec()
	return &undoneSequencesRemoved{
		senderId:  *senderId,
		sequences: sequences,
	}, nil
}

func (e *Event) toUndoneSequenceCompleted() (*undoneSequenceCompleted, error) {
	assume(len(e.Fields) == 2)
	senderId, err := e.Fields[0].ToByte32()
	if err != nil {
		return nil, err
	}
	remoteChainId, err := e.Fields[1].ToUint16()
	if err != nil {
		return nil, err
	}
	sequence, err := e.Fields[2].ToUint64()
	if err != nil {
		return nil, err
	}
	return &undoneSequenceCompleted{
		senderId:      *senderId,
		remoteChainId: remoteChainId,
		sequence:      sequence,
	}, nil
}

func (e *Event) toTokenBridgeForChainCreatedEvent() (*tokenBridgeForChainCreated, error) {
	assume(len(e.Fields) == 3)
	senderId, err := e.Fields[0].ToByte32()
	if err != nil {
		return nil, err
	}
	contractId, err := e.Fields[1].ToByte32()
	if err != nil {
		return nil, err
	}
	remoteChainId, err := e.Fields[2].ToUint16()
	if err != nil {
		return nil, err
	}
	return &tokenBridgeForChainCreated{
		senderId:      *senderId,
		contractId:    *contractId,
		remoteChainId: remoteChainId,
	}, nil
}

func (e *Event) toTokenWrapperCreatedEvent() (*tokenWrapperCreated, error) {
	assume(len(e.Fields) == 6)
	senderId, err := e.Fields[0].ToByte32()
	if err != nil {
		return nil, err
	}
	tokenBridgeForChainId, err := e.Fields[1].ToByte32()
	if err != nil {
		return nil, err
	}
	tokenWrapperId, err := e.Fields[2].ToByte32()
	if err != nil {
		return nil, err
	}
	isLocalToken := e.Fields[3].ToBool()
	tokenId, err := e.Fields[4].ToByte32()
	if err != nil {
		return nil, err
	}
	remoteChainId, err := e.Fields[5].ToUint16()
	if err != nil {
		return nil, err
	}
	return &tokenWrapperCreated{
		senderId:              *senderId,
		tokenBridgeForChainId: *tokenBridgeForChainId,
		tokenWrapperId:        *tokenWrapperId,
		isLocalToken:          isLocalToken,
		tokenId:               *tokenId,
		remoteChainId:         remoteChainId,
	}, nil
}

func (e *Event) getConsistencyLevel(minConfirmations uint8) (*uint8, error) {
	consistencyLevel, err := e.Fields[len(e.Fields)-1].ToUint8()
	if err != nil {
		return nil, err
	}

	confirmations := consistencyLevel
	if confirmations < minConfirmations {
		confirmations = minConfirmations
	}
	return &confirmations, nil
}

type Events struct {
	ChainFrom uint8    `json:"chainFrom"`
	ChainTo   uint8    `json:"chainTo"`
	Events    []*Event `json:"events"`
	NextCount uint64   `json:"nextCount"`
}

type BlockHeader struct {
	Hash      string `json:"hash"`
	Timestamp uint64 `json:"timestamp"`
	ChainFrom uint8  `json:"chainFrom"`
	ChainTo   uint8  `json:"chainTo"`
	Height    uint32 `json:"height"`
	// we don't need other fields now
}

type TxStatus struct {
	Type                   string `json:"type"`
	BlockHash              string `json:"blockHash"`
	TxIndex                int    `json:"txIndex"`
	ChainConfirmations     int    `json:"chainConfirmations"`
	FromGroupConfirmations int    `json:"fromGroupConfirmations"`
	ToGroupConfirmations   int    `json:"toGroupConfirmations"`
}

type NodeInfo struct {
	BuildInfo *BuildInfo `json:"buildInfo"`
}

type BuildInfo struct {
	ReleaseVersion string `json:"releaseVersion"`
	Commit         string `json:"commit"`
}

type ContractState struct {
	Address  string   `json:"address"`
	CodeHash string   `json:"codeHash"`
	Fields   []*Field `json:"fields"`
}

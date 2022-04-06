package alephium

import (
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"math/big"
	"runtime/debug"

	"github.com/btcsuite/btcutil/base58"
)

const HashLength = 32

func assume(cond bool) {
	if !cond {
		debug.PrintStack()
		panic(cond)
	}
}

func toContractId(address string) (Byte32, error) {
	var byte32 Byte32
	contractId := base58.Decode(address)
	if len(contractId) != 33 {
		return byte32, fmt.Errorf("invalid contract address %s", address)
	}
	assume(len(contractId) == 33)
	copy(byte32[:], contractId[1:])
	return byte32, nil
}

func toContractAddress(id Byte32) string {
	bytes := []byte{0x03}
	bytes = append(bytes, id[:]...)
	return base58.Encode(bytes)
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

type Event struct {
	BlockHash       string   `json:"blockHash"`
	ContractAddress string   `json:"contractAddress"`
	TxId            string   `json:"txId"`
	Index           int32    `json:"index"`
	Fields          []*Field `json:"fields"`
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

package alephium

import (
	"encoding/hex"
	"runtime/debug"
)

const HashLength = 32

func assume(cond bool) {
	if !cond {
		debug.PrintStack()
		panic(cond)
	}
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

func HexToHash(str string) Hash {
	assume(len(str) == 64)
	bytes, err := hex.DecodeString(str)
	assume(err == nil)
	var hash Hash
	copy(hash[:], bytes)
	return hash
}

type Field struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}

type Event struct {
	BlockHash  string  `json:"blockHash"`
	ContractId string  `json:"contractId"`
	TxId       string  `json:"txId"`
	Index      int32   `json:"index"`
	Fields     []Field `json:"fields"`
}

type Events struct {
	ChainFrom uint8   `json:"chainFrom"`
	ChainTo   uint8   `json:"chainTo"`
	Events    []Event `json:"events"`
}

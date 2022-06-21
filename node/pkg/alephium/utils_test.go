package alephium

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"testing"

	sdk "github.com/alephium/go-sdk"
	"github.com/btcsuite/btcutil/base58"
	"github.com/stretchr/testify/assert"
)

func u256Field(num int) sdk.Val {
	return sdk.Val{
		ValU256: &sdk.ValU256{
			Type:  "U256",
			Value: fmt.Sprintf("%d", num),
		},
	}
}

func byteVecField(hex string) sdk.Val {
	return sdk.Val{
		ValByteVec: &sdk.ValByteVec{
			Type:  "ByteVec",
			Value: hex,
		},
	}
}

func randomByte32() Byte32 {
	var byte32 Byte32
	size, err := rand.Read(byte32[:])
	assume(size == 32)
	assume(err == nil)
	return byte32
}

func randomAddress() string {
	var bytes []byte
	byte32 := randomByte32()
	bytes = append([]byte{3}, byte32[:]...)
	return base58.Encode(bytes)
}

func TestField(t *testing.T) {
	bigInt1 := big.NewInt(1)
	bigInt2 := big.NewInt(2)

	u256Max := new(big.Int).Sub(new(big.Int).Exp(bigInt2, big.NewInt(256), nil), bigInt1)
	i256Max := new(big.Int).Sub(new(big.Int).Exp(bigInt2, big.NewInt(255), nil), bigInt1)
	i256Min := new(big.Int).Neg(new(big.Int).Add(i256Max, bigInt1))

	values := [][]byte{
		[]byte(`{"type":"Bool","value":true}`),
		[]byte(`{"type":"Bool","value":false}`),
		[]byte(`{"type":"U256","value":"115792089237316195423570985008687907853269984665640564039457584007913129639935"}`), // u256 max value
		[]byte(`{"type":"I256","value":"57896044618658097711785492504343953926634992332820282019728792003956564819967"}`),  // i256 max value
		[]byte(`{"type":"I256","value":"-57896044618658097711785492504343953926634992332820282019728792003956564819968"}`), // i256 min value
		[]byte(`{"type":"ByteVec","value":"000102030405060708090a0b0c0d0e0f"}`),
		[]byte(`{"type":"Address","value":"14PqtYSSbwpUi2RJKUvv9yUwGafd6yHbEcke7ionuiE7w"}`),
	}
	results := []struct {
		Type  string
		Value interface{}
	}{
		{Type: "Bool", Value: true},
		{Type: "Bool", Value: false},
		{Type: "U256", Value: u256Max},
		{Type: "I256", Value: i256Max},
		{Type: "I256", Value: i256Min},
		{Type: "ByteVec", Value: []byte{0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f}},
		{Type: "Address", Value: "14PqtYSSbwpUi2RJKUvv9yUwGafd6yHbEcke7ionuiE7w"},
	}

	for i, result := range results {
		var field sdk.Val
		err := json.Unmarshal(values[i], &field)
		assert.Nil(t, err)

		switch result.Type {
		case "Bool":
			v, err := toBool(field)
			assert.Nil(t, err)
			assert.Equal(t, *v, result.Value)
		case "U256":
			v, err := toU256(field)
			assert.Nil(t, err)
			assert.Equal(t, v, result.Value)
		case "I256":
			v, err := toI256(field)
			assert.Nil(t, err)
			assert.Equal(t, v, result.Value)
		case "ByteVec":
			v, err := toByteVec(field)
			assert.Nil(t, err)
			assert.Equal(t, v, result.Value)
		case "Address":
			v, err := toAddress(field)
			assert.Nil(t, err)
			assert.Equal(t, *v, result.Value)
		}
	}
}

func TestAttestEvent(t *testing.T) {
	attestTokenEvent := &sdk.ContractEvent{
		BlockHash:  randomByte32().ToHex(),
		TxId:       randomByte32().ToHex(),
		EventIndex: 0,
		Fields: []sdk.Val{
			// sender
			byteVecField("deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07"),
			// sequence
			u256Field(100),
			// nonce
			byteVecField("12e551d9"),
			// payload
			byteVecField("029fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab00ff0800000000000000000000000000000000000000000000746573742d746f6b656e00000000000000000000000000000000000000000000746573742d746f6b656e"),
			// consistencyLevel
			u256Field(0),
		},
	}

	wormholeMessage, err := ToWormholeMessage(attestTokenEvent.Fields, attestTokenEvent.TxId)
	assert.Nil(t, err)
	assert.Equal(t, wormholeMessage.senderId.ToHex(), "deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07")
	assert.Equal(t, wormholeMessage.nonce, uint32(317018585))
	assert.Equal(t, wormholeMessage.payload, hexToBytes("029fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab00ff0800000000000000000000000000000000000000000000746573742d746f6b656e00000000000000000000000000000000000000000000746573742d746f6b656e"))
	assert.Equal(t, wormholeMessage.Sequence, uint64(100))
	assert.Equal(t, wormholeMessage.consistencyLevel, uint8(0))
}

func TestTransferEvent(t *testing.T) {
	transferEvent := &sdk.ContractEvent{
		BlockHash:  randomByte32().ToHex(),
		TxId:       randomByte32().ToHex(),
		EventIndex: 0,
		Fields: []sdk.Val{
			// sender
			byteVecField("deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07"),
			// sequence
			u256Field(101),
			// nonce
			byteVecField("1e308999"),
			// payload
			byteVecField("010000000000000000000000000000000000000000000000004563918244f400009fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab00ff0000000000000000000000000d0f183465284cb5cb426902445860456ed59b34000200000000000000000000000000000000000000000000000000005af3107a4000"),
			// consistencyLevel
			u256Field(1),
		},
	}

	wormholeMessage, err := ToWormholeMessage(transferEvent.Fields, transferEvent.TxId)
	assert.Nil(t, err)
	assert.Equal(t, wormholeMessage.senderId.ToHex(), "deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07")
	assert.Equal(t, wormholeMessage.nonce, uint32(506497433))
	assert.Equal(t, wormholeMessage.payload, hexToBytes("010000000000000000000000000000000000000000000000004563918244f400009fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab00ff0000000000000000000000000d0f183465284cb5cb426902445860456ed59b34000200000000000000000000000000000000000000000000000000005af3107a4000"))
	assert.Equal(t, wormholeMessage.Sequence, uint64(101))
	assert.Equal(t, wormholeMessage.consistencyLevel, uint8(1))
}

func TestContractConversion(t *testing.T) {
	bytes := randomByte32()
	address := ToContractAddress(bytes)
	id := toContractId(address)
	assert.Equal(t, bytes, id)
}

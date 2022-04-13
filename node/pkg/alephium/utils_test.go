package alephium

import (
	"encoding/json"
	"math/big"
	"testing"

	"github.com/stretchr/testify/assert"
)

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
	fields := []Field{
		{Type: "Bool", Value: true},
		{Type: "Bool", Value: false},
		{Type: "U256", Value: u256Max},
		{Type: "I256", Value: i256Max},
		{Type: "I256", Value: i256Min},
		{Type: "ByteVec", Value: []byte{0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f}},
		{Type: "Address", Value: "14PqtYSSbwpUi2RJKUvv9yUwGafd6yHbEcke7ionuiE7w"},
	}

	for i, val := range values {
		var field Field
		err := json.Unmarshal(val, &field)
		assert.Nil(t, err)
		assert.Equal(t, field.Type, fields[i].Type)

		switch field.Type {
		case "Bool":
			assert.Equal(t, field.ToBool(), fields[i].Value)
		case "U256":
			assert.Equal(t, field.ToU256(), fields[i].Value)
		case "I256":
			assert.Equal(t, field.ToI256(), fields[i].Value)
		case "ByteVec":
			assert.Equal(t, field.ToByteVec(), fields[i].Value)
		case "Address":
			assert.Equal(t, field.ToAddress(), fields[i].Value)
		}
	}
}

func TestContractConversion(t *testing.T) {
	bytes := randomByte32()
	address := toContractAddress(bytes)
	id := toContractId(address)
	assert.Equal(t, bytes, id)
}

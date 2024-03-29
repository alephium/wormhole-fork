package alephium

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"testing"

	sdk "github.com/alephium/go-sdk"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
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
	rand.Read(byte32[:])
	return byte32
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
			// targetChain
			u256Field(2),
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
	assert.Equal(t, wormholeMessage.targetChainId, uint16(2))
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
			// targetChain
			u256Field(3),
			// sequence
			u256Field(101),
			// nonce
			byteVecField("1e308999"),
			// payload
			byteVecField("010000000000000000000000000000000000000000000000004563918244f400009fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab00ff0000000000000000000000000d0f183465284cb5cb426902445860456ed59b3400000000000000000000000000000000000000000000000000005af3107a4000"),
			// consistencyLevel
			u256Field(1),
		},
	}

	wormholeMessage, err := ToWormholeMessage(transferEvent.Fields, transferEvent.TxId)
	assert.Nil(t, err)
	assert.Equal(t, wormholeMessage.senderId.ToHex(), "deae14cf3bcfaea1f8f7e905fd8b554833d1bccaa8a9a1dd01f29fea6c7bca07")
	assert.Equal(t, wormholeMessage.targetChainId, uint16(3))
	assert.Equal(t, wormholeMessage.nonce, uint32(506497433))
	assert.Equal(t, wormholeMessage.payload, hexToBytes("010000000000000000000000000000000000000000000000004563918244f400009fb80859f87d9d56a118624a12258e7dd471a0a474490807986d9b0bb7f576ab00ff0000000000000000000000000d0f183465284cb5cb426902445860456ed59b3400000000000000000000000000000000000000000000000000005af3107a4000"))
	assert.Equal(t, wormholeMessage.Sequence, uint64(101))
	assert.Equal(t, wormholeMessage.consistencyLevel, uint8(1))
}

func hexToBytes(str string) []byte {
	bytes, _ := hex.DecodeString(str)
	return bytes
}

func TestContractConversion(t *testing.T) {
	bytes := randomByte32()
	address, err := ToContractAddress(hex.EncodeToString(bytes[:]))
	assert.Nil(t, err)
	id, err := ToContractId(*address)
	assert.Nil(t, err)
	assert.Equal(t, bytes, id)
}

func TestHexToByte32(t *testing.T) {
	bytes := randomByte32()
	hex := bytes.ToHex()
	res, err := HexToByte32(hex)
	assert.Nil(t, err)
	assert.True(t, res.equalWith(bytes))
}

func TestBytesToString(t *testing.T) {
	padTo32Byte := func(bs []byte) []byte {
		prefix := make([]byte, 32-len(bs))
		return append(prefix, bs...)
	}

	strs := []string{"token0", "Token1", "Token 2", "112233", "/@!#$%^&*()=+"}
	for _, str := range strs {
		assert.Equal(t, bytesToString([]byte(str)), str)
		bs := padTo32Byte([]byte(str))
		assert.Equal(t, bytesToString(bs), str)
	}
}

func TestParseAttestToken(t *testing.T) {
	payload, err := hex.DecodeString("02eb2b70a55aec8562b6ccc6ca3ca4ed41176c611757a37748d005abee6a9fae5a00ff12000000000000000000000000000000000000000000000054657374546f6b656e00000000000000000000000000000000000000000054657374546f6b656e2d30")
	assert.Nil(t, err)
	tokenInfo, err := parseAttestToken(payload)
	assert.Nil(t, err)
	tokenId, _ := HexToByte32("eb2b70a55aec8562b6ccc6ca3ca4ed41176c611757a37748d005abee6a9fae5a")
	assert.Equal(t, *tokenInfo, TokenInfo{
		TokenId:  tokenId,
		Decimals: 18,
		Symbol:   "TestToken",
		Name:     "TestToken-0",
	})

	tokenInfo, err = parseAttestToken(payload[1:])
	assert.Nil(t, tokenInfo)
	assert.Equal(t, err.Error(), "invalid attest token payload length")

	tokenInfo, err = parseAttestToken(append(payload, 0))
	assert.Nil(t, tokenInfo)
	assert.Equal(t, err.Error(), "invalid attest token payload length")

	payload[34] = byte(vaa.ChainIDUnset)
	tokenInfo, err = parseAttestToken(payload)
	assert.Nil(t, tokenInfo)
	assert.Equal(t, err.Error(), "invalid token chain id")
}

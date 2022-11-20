package vaa

import (
	"encoding/hex"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
)

func TestCoreModule(t *testing.T) {
	hexifiedCoreModule := "00000000000000000000000000000000000000000000000000000000436f7265"
	assert.Equal(t, hex.EncodeToString(CoreModule), hexifiedCoreModule)
}

func TestBodyContractUpgrade(t *testing.T) {
	data := []byte{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4}
	test := BodyContractUpgrade{Payload: data}
	assert.Equal(t, test.Payload, data)
}

func TestBodyGuardianSetUpdate(t *testing.T) {
	keys := []common.Address{
		common.HexToAddress("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed"),
		common.HexToAddress("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaee"),
	}
	test := BodyGuardianSetUpgrade{Keys: keys, NewIndex: uint32(1)}
	assert.Equal(t, test.Keys, keys)
	assert.Equal(t, test.NewIndex, uint32(1))
}

func TestBodyTokenBridgeRegisterChain(t *testing.T) {
	module := "test"
	addr := Address{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4}
	test := BodyTokenBridgeRegisterChain{Module: module, ChainID: 1, EmitterAddress: addr}
	assert.Equal(t, test.Module, module)
	assert.Equal(t, test.ChainID, ChainID(1))
	assert.Equal(t, test.EmitterAddress, addr)
}

func TestBodyTokenBridgeUpgradeContract(t *testing.T) {
	module := "test"
	data := []byte{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4}
	test := BodyTokenBridgeUpgradeContract{Module: module, Payload: data}
	assert.Equal(t, test.Module, module)
	assert.Equal(t, test.Payload, data)
}

func TestBodyUpdateMessageFeeSerialize(t *testing.T) {
	newMessageFee := []byte{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0}
	body := BodyUpdateMessageFee{NewMessageFee: newMessageFee}
	expected := "00000000000000000000000000000000000000000000000000000000436f7265030000000000000000000000000000000000000000000101010101010100000000"
	serialized := body.Serialize()
	assert.Equal(t, hex.EncodeToString(serialized), expected)
}

func TestBodyTransferFeeSerialize(t *testing.T) {
	amount := []byte{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0}
	recipient, err := hex.DecodeString("6c9e363a430b14f135428ea6d7a5b1cf893485ab9495e325258e7b16925d62ab")
	assert.Nil(t, err)
	body := BodyTransferFee{
		Amount:    amount,
		Recipient: recipient,
	}
	expected := "00000000000000000000000000000000000000000000000000000000436f72650400000000000000000000000000000000000000000001010101010101000000006c9e363a430b14f135428ea6d7a5b1cf893485ab9495e325258e7b16925d62ab"
	serialized := body.Serialize()
	assert.Equal(t, hex.EncodeToString(serialized), expected)
}

func TestBodyContractUpgradeSerialize(t *testing.T) {
	data := []byte{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4}
	bodyContractUpgrade := BodyContractUpgrade{Payload: data}
	expected := "00000000000000000000000000000000000000000000000000000000436f7265010000000000000000000000000000000000000000000000000000000000000004"
	serializedBodyContractUpgrade := bodyContractUpgrade.Serialize()
	assert.Equal(t, hex.EncodeToString(serializedBodyContractUpgrade), expected)
}

func TestBodyGuardianSetUpdateSerialize(t *testing.T) {
	keys := []common.Address{
		common.HexToAddress("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed"),
		common.HexToAddress("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaee"),
	}
	bodyGuardianSetUpdate := BodyGuardianSetUpgrade{Keys: keys, NewIndex: uint32(1)}
	expected := "00000000000000000000000000000000000000000000000000000000436f72650200000001025aaeb6053f3e94c9b9a09f33669435e7ef1beaed5aaeb6053f3e94c9b9a09f33669435e7ef1beaee"
	serializedBodyGuardianSetUpdate := bodyGuardianSetUpdate.Serialize()
	assert.Equal(t, hex.EncodeToString(serializedBodyGuardianSetUpdate), expected)
}

func TestBodyTokenBridgeRegisterChainSerialize(t *testing.T) {
	module := "test"
	addr := Address{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4}
	bodyTokenBridgeRegisterChain := BodyTokenBridgeRegisterChain{Module: module, ChainID: 1, EmitterAddress: addr}
	expected := "00000000000000000000000000000000000000000000000000000000746573740100010000000000000000000000000000000000000000000000000000000000000004"
	serializedBodyTokenBridgeRegisterChain := bodyTokenBridgeRegisterChain.Serialize()
	assert.Equal(t, hex.EncodeToString(serializedBodyTokenBridgeRegisterChain), expected)
}

func TestBodyTokenBridgeUpgradeContractSerialize(t *testing.T) {
	module := "test"
	data := []byte{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4}
	bodyTokenBridgeUpgradeContract := BodyTokenBridgeUpgradeContract{Module: module, Payload: data}
	expected := "0000000000000000000000000000000000000000000000000000000074657374020000000000000000000000000000000000000000000000000000000000000004"
	serializedBodyTokenBridgeUpgradeContract := bodyTokenBridgeUpgradeContract.Serialize()
	assert.Equal(t, hex.EncodeToString(serializedBodyTokenBridgeUpgradeContract), expected)
}

func TestBodyTokenBridgeDestroyContractsSerialize(t *testing.T) {
	emitterChain := ChainIDEthereum
	sequences := []uint64{0, 1, 3, 8}
	body := BodyTokenBridgeDestroyContracts{
		EmitterChain: emitterChain,
		Sequences:    sequences,
	}
	expected := "000000000000000000000000000000000000000000546f6b656e427269646765f0000200040000000000000000000000000000000100000000000000030000000000000008"
	serialized := body.Serialize()
	assert.Equal(t, hex.EncodeToString(serialized), expected)
}

func TestBodyUpdateMinimalConsistencyLevelSerialize(t *testing.T) {
	body := BodyTokenBridgeUpdateMinimalConsistencyLevel{NewConsistencyLevel: 10}
	expected := "000000000000000000000000000000000000000000546f6b656e427269646765f10a"
	serialized := body.Serialize()
	assert.Equal(t, hex.EncodeToString(serialized), expected)
}

func TestBodyUpdateRefundAddressSerialize(t *testing.T) {
	address, err := hex.DecodeString("016c9e363a430b14f135428ea6d7a5b1cf893485ab9495e325258e7b16925d62ab")
	assert.Nil(t, err)
	body := BodyTokenBridgeUpdateRefundAddress{NewRefundAddress: address}
	expected := "000000000000000000000000000000000000000000546f6b656e427269646765f20021016c9e363a430b14f135428ea6d7a5b1cf893485ab9495e325258e7b16925d62ab"
	serialized := body.Serialize()
	assert.Equal(t, hex.EncodeToString(serialized), expected)
}

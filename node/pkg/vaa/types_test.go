package vaa

import (
	"crypto/ecdsa"
	"crypto/rand"
	"encoding/hex"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/require"
)

func TestSerializeDeserialize(t *testing.T) {
	tests := []struct {
		name string
		vaa  *VAA
	}{
		{
			name: "NormalVAA",
			vaa: &VAA{
				Version:          1,
				GuardianSetIndex: 9,
				Signatures: []*Signature{
					{
						Index:     1,
						Signature: [65]byte{},
					},
				},
				Timestamp:        time.Unix(2837, 0),
				Nonce:            10,
				Sequence:         3,
				ConsistencyLevel: 5,
				EmitterChain:     8,
				EmitterAddress:   Address{1, 2, 3},
				Payload:          []byte("abc"),
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {

			vaaData, err := test.vaa.Marshal()
			require.NoError(t, err)

			vaaParsed, err := Unmarshal(vaaData)
			require.NoError(t, err)

			require.EqualValues(t, test.vaa, vaaParsed)
		})
	}
}

func TestVerifySignature(t *testing.T) {
	v := &VAA{
		Version:          8,
		GuardianSetIndex: 9,
		Timestamp:        time.Unix(2837, 0),
		Nonce:            5,
		Sequence:         10,
		ConsistencyLevel: 2,
		EmitterChain:     2,
		EmitterAddress:   Address{0, 1, 2, 3, 4},
		Payload:          []byte("abcd"),
	}

	data := v.SigningMsg()

	key, err := ecdsa.GenerateKey(crypto.S256(), rand.Reader)
	require.NoError(t, err)

	sig, err := crypto.Sign(data.Bytes(), key)
	require.NoError(t, err)
	sigData := [65]byte{}
	copy(sigData[:], sig)

	v.Signatures = append(v.Signatures, &Signature{
		Index:     0,
		Signature: sigData,
	})
	addr := crypto.PubkeyToAddress(key.PublicKey)
	require.True(t, v.VerifySignatures([]common.Address{
		addr,
	}))
}

func TestBodyRegisterChain_Serialize(t *testing.T) {
	msg := &BodyTokenBridgeRegisterChain{
		ChainID:        8,
		EmitterAddress: Address{1, 2, 3, 4},
	}

	data := msg.Serialize()
	require.Equal(t, "00000000000000000000000000000000000000000000000000000000000000000100080102030400000000000000000000000000000000000000000000000000000000", hex.EncodeToString(data))
}

func TestBodyRegisterChain_Serializee(t *testing.T) {
	var governanceEmitterAddress = Address{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4}
	var governanceChainId = ChainIDSolana
	payload, _ := hex.DecodeString("000000000000000000000000000000000000000000546f6b656e42726964676501000000080102030400000000000000000000000000000000000000000000000000000000")
	key, _ := crypto.HexToECDSA("cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0")
	timestamp := time.Unix(0, 0)
	vaa := CreateGovernanceVAA(governanceChainId, governanceEmitterAddress, timestamp, 12, 38, ChainIDEthereum, 1, payload)
	vaa.AddSignature(key, 0)
	vaaData, _ := vaa.Marshal()
	require.Equal(t, "0100000001010034871608908f592f41a50403cf4cc8d22cb03b32fa00279eaa5df5398fc0a87a6ec53189837ed9c44931528d26c8b44d7d9a3270a6f48ec9923ddf164601bdef00000000000000000c000100020000000000000000000000000000000000000000000000000000000000000004000000000000002620000000000000000000000000000000000000000000546f6b656e42726964676501000000080102030400000000000000000000000000000000000000000000000000000000", hex.EncodeToString(vaaData))
}

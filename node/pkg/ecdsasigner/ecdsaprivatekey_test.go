package ecdsasigner

import (
	"math/big"
	"testing"

	"crypto/rand"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
)

func TestPrivateKey(t *testing.T) {
	gk, err := ethcrypto.GenerateKey()
	if err != nil {
		t.Fatal("Failed to generate key", err)
	}

	signer := ECDSAPrivateKey{Value: gk}
	address := ethcrypto.PubkeyToAddress(signer.PublicKey())

	for i := 0; i < 100; i++ {
		random, err := randomBytes(1000000)
		if err != nil {
			t.Fatal(err)
		}
		digest := ethcrypto.Keccak256Hash(random)

		signature, err := signer.Sign(digest.Bytes())
		if err != nil {
			t.Fatal(err)
		}
		verifySignature(t, digest.Bytes(), signature, address)
	}
}

func randomBytes(maxLength int64) ([]byte, error) {
	randomInt, err := rand.Int(rand.Reader, big.NewInt(maxLength))
	if err != nil {
		return nil, err
	}

	bytes := make([]byte, randomInt.Int64())
	_, err = rand.Read(bytes)
	if err != nil {
		return nil, err
	}

	return bytes, nil
}

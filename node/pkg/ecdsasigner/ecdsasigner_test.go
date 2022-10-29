package ecdsasigner

import (
	"context"
	"math/big"
	"testing"

	"crypto/rand"

	ethcommon "github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
)

func TestKMS(t *testing.T) {
	cloudKMSKeyName := "TODO"
	bCtx := context.Background()
	kmsClient, err := NewKMSClient(bCtx, cloudKMSKeyName)
	if err != nil {
		t.Fatalf("failed to setup KMS client: %v", err)
	}
	defer kmsClient.Client.Close()
	verifySigner(t, kmsClient)
}

func TestPrivateKey(t *testing.T) {
	gk, err := ethcrypto.GenerateKey()
	if err != nil {
		t.Fatal("Failed to generate key", err)
	}

	for i := 0; i < 100; i++ {
		verifySigner(t, &ECDSAPrivateKey{Value: gk})
	}
}

func verifySigner(t *testing.T, guardianSigner ECDSASigner) {
	bytes, err := randomBytes(1000000)
	if err != nil {
		t.Fatal(err)
	}

	digest := ethcrypto.Keccak256Hash(bytes)
	sig, err := guardianSigner.Sign(digest.Bytes())
	if err != nil {
		t.Fatal(err)
	}

	pk, err := ethcrypto.Ecrecover(digest.Bytes(), sig)
	if err != nil {
		t.Fatal(err)
	}

	signerAddr := ethcommon.BytesToAddress(ethcrypto.Keccak256(pk[1:])[12:])
	guardianAddr := ethcrypto.PubkeyToAddress(guardianSigner.PublicKey())
	assert.Equal(t, signerAddr, guardianAddr, "Signer address should match guardian address")
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

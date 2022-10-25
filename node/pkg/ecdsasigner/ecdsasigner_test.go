package ecdsasigner

import (
	"context"
	"testing"

	ethcommon "github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
)

func TestKMS(t *testing.T) {
	cloudKMSKeyName := "projects/alephium-wormhole/locations/global/keyRings/alephium-wormhole-guardian-0-keyring/cryptoKeys/alephium-wormhole-guardian-0-signing-key/cryptoKeyVersions/1"
	bCtx := context.Background()
	kmsClient, err := NewKMSClient(bCtx, cloudKMSKeyName)
	if err != nil {
		t.Fatalf("failed to setup KMS client: %v", err)
	}
	defer kmsClient.client.Close()
	verifySigner(t, kmsClient)
}

func TestPrivateKey(t *testing.T) {
	gk, err := ethcrypto.GenerateKey()
	if err != nil {
		t.Fatal("Failed to generate key", err)
	}

	verifySigner(t, ECDSAPrivateKey{value: gk})
}

func verifySigner(t *testing.T, guardianSigner ECDSASigner) {
	digest := ethcrypto.Keccak256Hash([]byte("Hello"))
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

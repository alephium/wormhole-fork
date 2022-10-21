package guardiand

import (
	"context"
	"encoding/hex"
	"fmt"
	"log"
	"testing"

	"github.com/certusone/wormhole/node/pkg/common"
	ethcommon "github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"go.uber.org/zap"
)

func TestKMS(t *testing.T) {
	cloudKMSKeyName := "projects/alephium-wormhole/locations/global/keyRings/alephium-wormhole-guardian-0-keyring/cryptoKeys/alephium-wormhole-guardian-0-signing-key/cryptoKeyVersions/1"
	bCtx := context.Background()
	kmsClient, err := NewKMSClient(bCtx, cloudKMSKeyName)
	if err != nil {
		t.Fatalf("failed to setup KMS client: %v", err)
	}
	defer kmsClient.client.Close()

	var guardianSigner common.ECDSASigner
	guardianSigner = kmsClient
	digest := ethcrypto.Keccak256Hash([]byte("Hello"))
	sig, err := guardianSigner.Sign(digest.Bytes())
	if err != nil {
		t.Fatal(err)
	}
	pk, err := ethcrypto.Ecrecover(digest.Bytes(), sig)
	if err != nil {
		t.Fatal(err)
	}

	signer_pk := ethcommon.BytesToAddress(ethcrypto.Keccak256(pk[1:])[12:])
	their_addr := ethcrypto.PubkeyToAddress(guardianSigner.PublicKey())

	log.Println(fmt.Sprintf("sig v %d", sig[64]))
	if their_addr != signer_pk {
		log.Println("invalid observation - address does not match pubkey",
			zap.String("digest", hex.EncodeToString(digest[:])),
			zap.String("signature", hex.EncodeToString(sig)),
			zap.String("addr", their_addr.Hex()),
			zap.String("pk", signer_pk.Hex()))
	} else {
		log.Println("valid observation - address matches pubkey",
			zap.String("digest", hex.EncodeToString(digest[:])),
			zap.String("signature", hex.EncodeToString(sig)),
			zap.String("addr", their_addr.Hex()),
			zap.String("pk", signer_pk.Hex()))
	}
}

func TestPrivateKey(t *testing.T) {
	gk, err := loadGuardianKey("/tmp/bridge.key")
	if err != nil {
		t.Fatal("failed to load guardian key", err)
	}

	var guardianSigner common.ECDSASigner
	guardianSigner = ECDSAPrivateKey{
		value: gk,
	}

	digest := ethcrypto.Keccak256Hash([]byte("Hello"))
	sig, err := guardianSigner.Sign(digest.Bytes())
	pk, err := ethcrypto.Ecrecover(digest.Bytes(), sig)

	signer_pk := ethcommon.BytesToAddress(ethcrypto.Keccak256(pk[1:])[12:])
	their_addr := ethcrypto.PubkeyToAddress(guardianSigner.PublicKey())

	if their_addr != signer_pk {
		log.Println("invalid observation - address does not match pubkey",
			zap.String("digest", hex.EncodeToString(digest[:])),
			zap.String("signature", hex.EncodeToString(sig)),
			zap.String("addr", their_addr.Hex()),
			zap.String("pk", signer_pk.Hex()))
	} else {
		log.Println("valid observation - address matches pubkey",
			zap.String("digest", hex.EncodeToString(digest[:])),
			zap.String("signature", hex.EncodeToString(sig)),
			zap.String("addr", their_addr.Hex()),
			zap.String("pk", signer_pk.Hex()))
	}

	if err != nil {
		t.Fatal(err)
	}
}

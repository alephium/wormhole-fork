package ecdsasigner

import (
	"encoding/base64"
	"encoding/json"
	"os"
	"testing"

	ethcrypto "github.com/ethereum/go-ethereum/crypto"
)

type CloudKMSDigestSignature struct {
	Digest    string `json:"digest"`
	Signature string `json:"signature"`
}

func TestCloudKMS(t *testing.T) {
	// Public key in PEM format returned from the Google KMS API
	cloudKMSPublicKey := `-----BEGIN PUBLIC KEY-----
MFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEvM64WybBvE80lglbeucaazgkOqM7C4+f
lT9nxEZvjfrPc6rrIm8MIaCSV2VlIp49i5uE6N4+GNlrt3lrWOFHkw==
-----END PUBLIC KEY-----`
	ecdsaPublicKey, err := convertToECDSAPublicKey(cloudKMSPublicKey)
	if err != nil {
		t.Fatal("Failed to convert Cloud KMS public key to ECDSA public key", err)
	}
	cloudKMSAddress := ethcrypto.PubkeyToAddress(*ecdsaPublicKey)

	fixtureBytes, err := os.ReadFile("./fixture/cloudkms_digest_signature_fixture.json")
	if err != nil {
		t.Fatal("Failed to read fixture", err)
	}
	var cloudKMSDigestSignatures []CloudKMSDigestSignature
	if err = json.Unmarshal(fixtureBytes, &cloudKMSDigestSignatures); err != nil {
		t.Fatal("Failed to parse fixture", err)
	}

	for _, cloudKMSDigestSignature := range cloudKMSDigestSignatures {
		cloudKMSSignature, err := base64.StdEncoding.DecodeString(cloudKMSDigestSignature.Signature)
		if err != nil {
			t.Fatal("Failed to decode cloud KMS signature", err)
		}
		digest, err := base64.StdEncoding.DecodeString(cloudKMSDigestSignature.Digest)
		if err != nil {
			t.Fatal("Failed to decode digest", err)
		}

		signature, err := parseSignature(cloudKMSSignature, digest, cloudKMSAddress)
		verifySignature(t, digest, signature, cloudKMSAddress)
	}
}

package ecdsasigner

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"hash/crc32"
	"math/big"

	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/pem"

	kms "cloud.google.com/go/kms/apiv1"
	ethcommon "github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"google.golang.org/api/option"
	kmspb "google.golang.org/genproto/googleapis/cloud/kms/v1"
	"google.golang.org/protobuf/types/known/wrapperspb"
)

// Client is a client for interacting with the Google Cloud KMS API
type KMSClient struct {
	keyId     string
	ctx       context.Context
	publicKey *ecdsa.PublicKey
	Client    *kms.KeyManagementClient
}

func NewKMSClient(ctx context.Context, keyId string, opts ...option.ClientOption) (*KMSClient, error) {
	client, err := kms.NewKeyManagementClient(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("Failed to initialize KMS client: %w", err)
	}

	pubKey, err := getKMSPublicKey(ctx, keyId, *client)
	if err != nil {
		return nil, fmt.Errorf("Failed to get public key for KMS client: %w", err)
	}

	return &KMSClient{
		keyId:     keyId,
		ctx:       ctx,
		publicKey: pubKey,
		Client:    client,
	}, nil
}

// ECDSASigner methods
func (c *KMSClient) Sign(digest []byte) ([]byte, error) {
	req := &kmspb.AsymmetricSignRequest{
		Name: c.keyId,
		Digest: &kmspb.Digest{
			Digest: &kmspb.Digest_Sha256{
				Sha256: digest,
			},
		},
		DigestCrc32C: crc32Checksum(digest),
	}

	signResult, err := c.Client.AsymmetricSign(c.ctx, req)

	if err != nil {
		return nil, fmt.Errorf("Failed to sign with KMS: %w", err)
	}

	if !signResult.VerifiedDigestCrc32C {
		return nil, fmt.Errorf("KMS signing request corrupted in-transit")
	}
	if signResult.SignatureCrc32C.Value != crc32Checksum(signResult.Signature).Value {
		return nil, fmt.Errorf("KMS singing response corrupted in-transit")
	}

	address := ethcrypto.PubkeyToAddress(*c.publicKey)

	signature, err := parseSignature(signResult.Signature, digest, address)
	if err != nil {
		return nil, fmt.Errorf("Failed to parse KMS signature: %w", err)
	}

	return signature, nil
}

func (c *KMSClient) PublicKey() ecdsa.PublicKey {
	return *c.publicKey
}

// Private Functions
func crc32Checksum(data []byte) *wrapperspb.Int64Value {
	// compute CRC32
	table := crc32.MakeTable(crc32.Castagnoli)
	checksum := crc32.Checksum(data, table)
	val := wrapperspb.Int64(int64(checksum))
	return val
}

func getKMSPublicKey(
	ctx context.Context,
	keyId string,
	client kms.KeyManagementClient,
) (*ecdsa.PublicKey, error) {
	request := &kmspb.GetPublicKeyRequest{Name: keyId}

	kmsPublicKey, err := client.GetPublicKey(ctx, request)
	if err != nil {
		return nil, fmt.Errorf("Failed to fetch public key from the KMS API: %v", err)
	}

	return convertToECDSAPublicKey(kmsPublicKey.Pem)
}

func convertToECDSAPublicKey(
	kmsPublicKeyPem string,
) (*ecdsa.PublicKey, error) {
	pemBlock, rest := pem.Decode([]byte(kmsPublicKeyPem))
	if len(rest) > 0 {
		return nil, fmt.Errorf("PEM block contains more than just public key")
	}

	var pki struct {
		Raw       asn1.RawContent
		Algorithm pkix.AlgorithmIdentifier
		PublicKey asn1.BitString
	}
	if rest, err := asn1.Unmarshal(pemBlock.Bytes, &pki); err != nil {
		return nil, fmt.Errorf("Failed to unmarshal KMS public key from pem block: %v", err)
	} else if len(rest) != 0 {
		return nil, fmt.Errorf("Trailing data after ASN.1 unmarshalling of the KMS public key")
	}

	asn1Data := pki.PublicKey.RightAlign()
	if asn1Data[0] != 4 {
		return nil, fmt.Errorf("Only uncompressed public key is supported")
	}

	secp256k1Curve := ethcrypto.S256()
	p := secp256k1Curve.Params().P
	plen := bitsToBytes(p.BitLen())

	asn1PubKeyBytes := asn1Data[1:]
	if len(asn1PubKeyBytes) != 2*plen {
		return nil, fmt.Errorf("Public key has incorrect size, got %d, expects %d", len(asn1PubKeyBytes), 2*plen)
	}

	var x, y big.Int
	x.SetBytes(asn1PubKeyBytes[:plen])
	y.SetBytes(asn1PubKeyBytes[plen:])

	if x.Cmp(p) >= 0 || y.Cmp(p) >= 0 || !secp256k1Curve.IsOnCurve(&x, &y) {
		return nil, fmt.Errorf("kms input is not on curve")
	}

	return &ecdsa.PublicKey{Curve: secp256k1Curve, X: &x, Y: &y}, nil
}

func parseSignature(kmsSignature []byte, digest []byte, pubKey ethcommon.Address) ([]byte, error) {
	var parsedSig struct{ R, S *big.Int }
	if _, err := asn1.Unmarshal(kmsSignature, &parsedSig); err != nil {
		return nil, fmt.Errorf("Fail to unmarshal KMS signature: %w", err)
	}

	curveOrderLen := 32
	signature := make([]byte, 2*curveOrderLen)

	rBytes := trimLeftByte(parsedSig.R.Bytes(), byte(0))
	sBytes := trimLeftByte(parsedSig.S.Bytes(), byte(0))
	copy(signature[curveOrderLen-len(rBytes):], rBytes)
	copy(signature[len(signature)-len(sBytes):], sBytes)

	return appendV(signature, digest, pubKey)
}

func appendV(sig []byte, digest []byte, pubKey ethcommon.Address) ([]byte, error) {
	for i := 0; i < 2; i++ {
		sigWithV := append(sig, byte(i))
		pk, err := ethcrypto.Ecrecover(digest, sigWithV)
		signer_pk := ethcommon.BytesToAddress(ethcrypto.Keccak256(pk[1:])[12:])
		if err == nil && signer_pk == pubKey {
			return sigWithV, nil
		}
	}

	return nil, fmt.Errorf("Can not append V for KMS signature")
}

func bitsToBytes(bits int) int {
	return (bits + 7) >> 3
}

func trimLeftByte(s []byte, c byte) []byte {
	for len(s) > 0 && s[0] == c {
		s = s[1:]
	}
	return s
}

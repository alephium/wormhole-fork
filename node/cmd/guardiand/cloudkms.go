package guardiand

import "C"

import (
	"context"
	"crypto/ecdsa"
	"fmt"
	"math/big"

	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/pem"

	kms "cloud.google.com/go/kms/apiv1"
	ethcommon "github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"google.golang.org/api/option"
	kmspb "google.golang.org/genproto/googleapis/cloud/kms/v1"
)

type publicKeyInfo struct {
	Raw       asn1.RawContent
	Algorithm pkix.AlgorithmIdentifier
	PublicKey asn1.BitString
}

// Client is a client for interacting with the Google Cloud KMS API
// using types native to the Flow Go SDK.
type KMSClient struct {
	keyId     string
	ctx       context.Context
	publicKey *ecdsa.PublicKey
	client    *kms.KeyManagementClient
}

func NewKMSClient(ctx context.Context, keyId string, opts ...option.ClientOption) (*KMSClient, error) {
	client, err := kms.NewKeyManagementClient(ctx, opts...)
	if err != nil {
		return nil, fmt.Errorf("cloudkms: failed to initialize client: %w", err)
	}

	pubKey, err := GetPublicKey(ctx, keyId, *client)
	if err != nil {
		return nil, fmt.Errorf("cloudkms: failed to get public key for kms client: %w", err)
	}

	return &KMSClient{
		keyId:     keyId,
		ctx:       ctx,
		publicKey: pubKey,
		client:    client,
	}, nil
}

func GetPublicKey(
	ctx context.Context,
	keyId string,
	client kms.KeyManagementClient,
) (*ecdsa.PublicKey, error) {
	request := &kmspb.GetPublicKeyRequest{
		Name: keyId,
	}

	result, err := client.GetPublicKey(ctx, request)
	if err != nil {
		return nil, fmt.Errorf("cloudkms: failed to fetch public key from KMS API: %v", err)
	}

	block, rest := pem.Decode([]byte(result.Pem))
	if len(rest) > 0 {
		return nil, fmt.Errorf("PEM block contains more than just public key")
	}

	var pki publicKeyInfo
	if rest, err := asn1.Unmarshal(block.Bytes, &pki); err != nil {
		return nil, fmt.Errorf("Failed to unmarshal public key from pem block: %v", err)
	} else if len(rest) != 0 {
		return nil, fmt.Errorf("x509: trailing data after ASN.1 of public-key")
	}

	asn1Data := pki.PublicKey.RightAlign()
	paramsData := pki.Algorithm.Parameters.FullBytes
	namedCurveOID := new(asn1.ObjectIdentifier)
	rest, err = asn1.Unmarshal(paramsData, namedCurveOID)
	if err != nil {
		return nil, fmt.Errorf("x509: failed to parse ECDSA parameters as named curve")
	}
	if len(rest) != 0 {
		return nil, fmt.Errorf("x509: trailing data after ECDSA parameters")
	}
	if asn1Data[0] != 4 { // uncompressed form
		return nil, fmt.Errorf("x509: only uncompressed keys are supported")
	}

	asn1PubKeyBytes := asn1Data[1:]
	curve := ethcrypto.S256()
	p := curve.Params().P
	plen := bitsToBytes(p.BitLen())
	if len(asn1PubKeyBytes) != 2*plen {
		return nil, fmt.Errorf("input has incorrect key size, got %d, expects %d", len(asn1PubKeyBytes), 2*plen)
	}

	var x, y big.Int
	x.SetBytes(asn1PubKeyBytes[:plen])
	y.SetBytes(asn1PubKeyBytes[plen:])

	if x.Cmp(p) >= 0 || y.Cmp(p) >= 0 || !curve.IsOnCurve(&x, &y) {
		return nil, fmt.Errorf("kms input is not on curve")
	}

	return &ecdsa.PublicKey{
		Curve: curve,
		X:     &x,
		Y:     &y,
	}, nil
}

func (c KMSClient) Sign(digest []byte) ([]byte, error) {
	// Need to investigate, not sure if this works
	// https://github.com/celo-org/optics-monorepo/discussions/598
	req := &kmspb.AsymmetricSignRequest{
		Name: c.keyId,
		Digest: &kmspb.Digest{
			Digest: &kmspb.Digest_Sha256{
				Sha256: digest,
			},
		},
	}

	result, err := c.client.AsymmetricSign(c.ctx, req)
	if err != nil {
		return nil, fmt.Errorf("cloudkms: failed to sign: %w", err)
	}

	pubKey := ethcrypto.PubkeyToAddress(*c.publicKey)

	sig, err := parseSignature(result.Signature, digest, pubKey)
	if err != nil {
		return nil, fmt.Errorf("cloudkms: failed to parse signature: %w", err)
	}

	return sig, nil
}

func parseSignature(kmsSignature []byte, digest []byte, pubKey ethcommon.Address) ([]byte, error) {
	var parsedSig struct{ R, S *big.Int }
	if _, err := asn1.Unmarshal(kmsSignature, &parsedSig); err != nil {
		return nil, fmt.Errorf("asn1.Unmarshal: %w", err)
	}

	curveOrderLen := 32
	signature := make([]byte, 2*curveOrderLen)

	// left pad R and S with zeroes
	rBytes := parsedSig.R.Bytes()
	sBytes := parsedSig.S.Bytes()
	copy(signature[curveOrderLen-len(rBytes):], rBytes)
	copy(signature[len(signature)-len(sBytes):], sBytes)

	return appendV(signature, digest, pubKey)
}

func appendV(sig []byte, digest []byte, pubKey ethcommon.Address) ([]byte, error) {
	sigWithV := append(sig, 0)
	for i := 0; i < 4; i++ {
		pk, err := ethcrypto.Ecrecover(digest, sigWithV)
		signer_pk := ethcommon.BytesToAddress(ethcrypto.Keccak256(pk[1:])[12:])
		if err == nil && signer_pk == pubKey {
			return sigWithV, nil
		}
		sigWithV = append(sig, byte(i))
	}

	return nil, fmt.Errorf("Can not append V for KMS signature")
}

func (c KMSClient) PublicKey() ecdsa.PublicKey {
	return *c.publicKey
}

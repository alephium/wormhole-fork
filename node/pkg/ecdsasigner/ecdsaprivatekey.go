package ecdsasigner

import (
	"crypto/ecdsa"
	"github.com/ethereum/go-ethereum/crypto"
)

type ECDSAPrivateKey struct {
	Value *ecdsa.PrivateKey
}

func (k *ECDSAPrivateKey) Sign(digestHash []byte) (sig []byte, err error) {
	return crypto.Sign(digestHash, k.Value)
}

func (k *ECDSAPrivateKey) PublicKey() ecdsa.PublicKey {
	return k.Value.PublicKey
}

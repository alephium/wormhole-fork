package ecdsasigner

import (
	"crypto/ecdsa"
	"github.com/ethereum/go-ethereum/crypto"
)

type ECDSAPrivateKey struct {
	value *ecdsa.PrivateKey
}

func (k ECDSAPrivateKey) Sign(digestHash []byte) (sig []byte, err error) {
	return crypto.Sign(digestHash, k.value)
}

func (k ECDSAPrivateKey) PublicKey() ecdsa.PublicKey {
	return k.value.PublicKey
}

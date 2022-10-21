package common

import (
	"crypto/ecdsa"
)

type ECDSASigner interface {
	// Sign generates a signature using the provided hasher.
	Sign([]byte) (sig []byte, err error)
	// PublicKey returns the public key.
	PublicKey() ecdsa.PublicKey
}

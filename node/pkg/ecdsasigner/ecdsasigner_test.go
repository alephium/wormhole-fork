package ecdsasigner

import (
	"testing"

	ethcommon "github.com/ethereum/go-ethereum/common"
	ethcrypto "github.com/ethereum/go-ethereum/crypto"
	"github.com/stretchr/testify/assert"
)

func verifySignature(
	t *testing.T,
	digest []byte,
	signature []byte,
	expectedSignerAddress ethcommon.Address,
) {
	signerPublicKey, err := ethcrypto.Ecrecover(digest, signature)
	if err != nil {
		t.Fatal(err)
	}

	signerAddress := ethcommon.BytesToAddress(ethcrypto.Keccak256(signerPublicKey[1:])[12:])
	assert.Equal(
		t,
		signerAddress,
		expectedSignerAddress,
		"Recovered signer address doesn't match the expected signer address",
	)
}

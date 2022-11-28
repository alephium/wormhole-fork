package vaa

import (
	"time"
)

func CreateGovernanceVAA(
	governanceChainId ChainID,
	governanceEmitterAddress Address,
	timestamp time.Time,
	nonce uint32,
	sequence uint64,
	targetChain ChainID,
	guardianSetIndex uint32,
	payload []byte,
) *VAA {
	vaa := &VAA{
		Version:          SupportedVAAVersion,
		GuardianSetIndex: guardianSetIndex,
		Signatures:       nil,
		Timestamp:        timestamp,
		Nonce:            nonce,
		Sequence:         sequence,
		ConsistencyLevel: 32,
		EmitterChain:     governanceChainId,
		TargetChain:      targetChain,
		EmitterAddress:   governanceEmitterAddress,
		Payload:          payload,
	}

	return vaa
}

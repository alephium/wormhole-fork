package guardiansets

import (
	"math/rand"
	"sync"
	"testing"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap/zaptest"
)

func randomAddress() eth_common.Address {
	bytes := make([]byte, 20)
	rand.Read(bytes)
	return eth_common.BytesToAddress(bytes)
}

func randomGuardianSet(index uint32) *common.GuardianSet {
	return &common.GuardianSet{
		Keys:  []eth_common.Address{randomAddress()},
		Index: index,
	}
}

func TestUpdateGuardianSet(t *testing.T) {
	gsSize := 10
	gsList := make([]*common.GuardianSet, gsSize)
	for i := 0; i < gsSize; i++ {
		gsList[i] = randomGuardianSet(uint32(i))
	}

	guardianSets := &GuardianSets{
		lock:                    sync.Mutex{},
		currentGuardianSetIndex: 0,
		guardianSetLists:        gsList[0:1],
		ethRpcUrl:               "",
		logger:                  zaptest.NewLogger(t),
		duration:                time.Second,
		ethGovernanceAddress:    randomAddress(),
		guardianSetC:            nil,
	}

	guardianSets.updateGuardianSets(gsList[0:1])
	assert.Equal(t, guardianSets.currentGuardianSetIndex, 0)
	assert.Equal(t, len(guardianSets.guardianSetLists), 1)

	guardianSets.updateGuardianSets(gsList[1:2])
	assert.Equal(t, guardianSets.currentGuardianSetIndex, 1)
	assert.Equal(t, len(guardianSets.guardianSetLists), 2)

	guardianSets.updateGuardianSets(gsList[2:4])
	assert.Equal(t, guardianSets.currentGuardianSetIndex, 3)
	assert.Equal(t, len(guardianSets.guardianSetLists), 4)

	guardianSets.updateGuardianSets(gsList[3:5])
	assert.Equal(t, guardianSets.currentGuardianSetIndex, 4)
	assert.Equal(t, len(guardianSets.guardianSetLists), 5)

	guardianSets.updateGuardianSets([]*common.GuardianSet{})
	assert.Equal(t, guardianSets.currentGuardianSetIndex, 4)
	assert.Equal(t, len(guardianSets.guardianSetLists), 5)

	guardianSets.updateGuardianSets(gsList[5:gsSize])
	assert.Equal(t, guardianSets.currentGuardianSetIndex, gsSize-1)
	assert.Equal(t, len(guardianSets.guardianSetLists), gsSize)
}

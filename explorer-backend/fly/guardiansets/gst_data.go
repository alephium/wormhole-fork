package guardiansets

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/ethereum/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"go.uber.org/zap"
)

type GuardianSets struct {
	lock                    sync.Mutex
	currentGuardianSetIndex int
	guardianSetLists        []*common.GuardianSet
	ethRpcUrl               string
	logger                  *zap.Logger
	duration                time.Duration
	ethGovernanceAddress    eth_common.Address
	guardianSetC            chan<- *common.GuardianSet
}

func NewGuardianSets(
	guardianSets []*common.GuardianSet,
	ethRpcUrl string,
	logger *zap.Logger,
	duration time.Duration,
	ethGovernanceAddress eth_common.Address,
	guardianSetC chan<- *common.GuardianSet,
) *GuardianSets {
	return &GuardianSets{
		lock:                    sync.Mutex{},
		currentGuardianSetIndex: len(guardianSets) - 1,
		guardianSetLists:        guardianSets,
		ethRpcUrl:               ethRpcUrl,
		logger:                  logger,
		duration:                duration,
		ethGovernanceAddress:    ethGovernanceAddress,
		guardianSetC:            guardianSetC,
	}
}

func (gs *GuardianSets) GetGuardianSet(ctx context.Context, index int) (*common.GuardianSet, error) {
	if index <= gs.currentGuardianSetIndex {
		return gs.guardianSetLists[index], nil
	}

	// Perhaps the guardian set has been updated and we need to query from the chain
	guardianSets, err := gs.getGuardianSetsRange(ctx, uint32(gs.currentGuardianSetIndex+1), uint32(index))
	if err != nil {
		return nil, err
	}
	gs.updateGuardianSets(guardianSets)
	gs.guardianSetC <- gs.GetCurrentGuardianSet()

	if index > gs.currentGuardianSetIndex {
		return nil, fmt.Errorf("invalid guardian index %v, current guardian set index: %v", index, gs.currentGuardianSetIndex)
	}
	return gs.guardianSetLists[index], nil
}

func (gs *GuardianSets) GetCurrentGuardianSet() *common.GuardianSet {
	return gs.guardianSetLists[gs.currentGuardianSetIndex]
}

func (gs *GuardianSets) UpdateGuardianSet(ctx context.Context) {
	go gs.updateGuardianSet(ctx)
}

func (gs *GuardianSets) updateGuardianSet(ctx context.Context) {
	tick := time.NewTicker(gs.duration)

	for {
		select {
		case <-tick.C:
			guardianSets, err := GetGuardianSetsFromChain(ctx, gs.ethRpcUrl, gs.ethGovernanceAddress, uint32(gs.currentGuardianSetIndex+1))
			if err != nil {
				gs.logger.Error("failed to get guardian sets", zap.Error(err))
				continue
			}
			gs.updateGuardianSets(guardianSets)
			gs.guardianSetC <- gs.GetCurrentGuardianSet()

		case <-ctx.Done():
			return
		}
	}
}

func (gs *GuardianSets) updateGuardianSets(guardianSets []*common.GuardianSet) error {
	if len(guardianSets) == 0 {
		return nil
	}

	gs.lock.Lock()
	defer gs.lock.Unlock()

	maxGuardianSetIndex := guardianSets[len(guardianSets)-1].Index
	if maxGuardianSetIndex <= uint32(gs.currentGuardianSetIndex) {
		return nil
	}
	index := 0
	for i, guardianSet := range guardianSets {
		if guardianSet.Index == uint32(gs.currentGuardianSetIndex)+1 {
			index = i
			break
		}
	}

	gs.currentGuardianSetIndex = int(maxGuardianSetIndex)
	gs.guardianSetLists = append(gs.guardianSetLists, guardianSets[index:]...)

	if len(gs.guardianSetLists) != gs.currentGuardianSetIndex+1 {
		return fmt.Errorf("invalid guardian sets, currentGuardianSetIndex: %v, guardianSetSize: %v", gs.currentGuardianSetIndex, len(gs.guardianSetLists))
	}
	return nil
}

func (gs *GuardianSets) getGuardianSetsRange(ctx context.Context, fromIndex uint32, toIndex uint32) ([]*common.GuardianSet, error) {
	gs.logger.Info(
		"trying to get missing guardian sets from chain",
		zap.Uint32("fromIndex", fromIndex),
		zap.Uint32("toIndex", toIndex),
	)

	contract, err := getContract(ctx, gs.ethRpcUrl, gs.ethGovernanceAddress)
	if err != nil {
		return nil, err
	}
	return getGuardianSetsFromChain(ctx, contract, fromIndex, toIndex)
}

func getContract(ctx context.Context, ethRpcUrl string, ethGovernanceAddress eth_common.Address) (*abi.Abi, error) {
	c, err := ethclient.DialContext(ctx, ethRpcUrl)
	if err != nil {
		return nil, err
	}
	contract, err := abi.NewAbi(ethGovernanceAddress, c)
	if err != nil {
		return nil, err
	}
	return contract, nil
}

func GetGuardianSetsFromChain(ctx context.Context, ethRpcUrl string, ethGovernanceAddress eth_common.Address, fromIndex uint32) ([]*common.GuardianSet, error) {
	contract, err := getContract(ctx, ethRpcUrl, ethGovernanceAddress)
	if err != nil {
		return nil, err
	}
	callOpt := &bind.CallOpts{Context: ctx}
	currentIndex, err := contract.GetCurrentGuardianSetIndex(callOpt)
	if err != nil {
		return nil, err
	}
	return getGuardianSetsFromChain(ctx, contract, fromIndex, currentIndex)
}

func getGuardianSetsFromChain(ctx context.Context, contract *abi.Abi, fromIndex, toIndex uint32) ([]*common.GuardianSet, error) {
	guardianSets := make([]*common.GuardianSet, 0)
	callOpt := &bind.CallOpts{Context: ctx}
	for index := fromIndex; index <= toIndex; index++ {
		res, err := contract.GetGuardianSet(callOpt, index)
		if err != nil {
			return nil, err
		}
		guardianSets = append(guardianSets, &common.GuardianSet{
			Keys:  res.Keys,
			Index: index,
		})
	}
	return guardianSets, nil
}

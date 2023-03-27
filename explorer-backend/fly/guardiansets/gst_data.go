package guardiansets

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/ethereum/abi"
	publicrpcv1 "github.com/alephium/wormhole-fork/node/pkg/proto/publicrpc/v1"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	eth_common "github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	"go.uber.org/zap"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type GuardianSets struct {
	lock                    sync.Mutex
	currentGuardianSetIndex int
	guardianSetLists        []*common.GuardianSet
	guardianUrl             string
	ethRpcUrl               string
	logger                  *zap.Logger
	duration                time.Duration
	ethGovernanceAddress    eth_common.Address
	guardianSetC            chan<- *common.GuardianSet
}

func NewGuardianSets(
	guardianSets []*common.GuardianSet,
	guardianUrl string,
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
		guardianUrl:             guardianUrl,
		ethRpcUrl:               ethRpcUrl,
		logger:                  logger,
		duration:                duration,
		ethGovernanceAddress:    ethGovernanceAddress,
		guardianSetC:            guardianSetC,
	}
}

func (gs *GuardianSets) GetGuardianSet(index int) (*common.GuardianSet, error) {
	if index > gs.currentGuardianSetIndex {
		return nil, fmt.Errorf("index: %v, current guardian set index: %v", index, gs.currentGuardianSetIndex)
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
	conn, err := grpc.Dial(gs.guardianUrl, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		gs.logger.Fatal("failed to connect to guardian", zap.Error(err))
	}
	defer conn.Close()
	client := publicrpcv1.NewPublicRPCServiceClient(conn)
	tick := time.NewTicker(gs.duration)

	for {
		select {
		case <-tick.C:
			resp, err := client.GetCurrentGuardianSet(ctx, &publicrpcv1.GetCurrentGuardianSetRequest{})
			if err != nil {
				gs.logger.Error("failed to get current guardian set", zap.Error(err))
				continue
			}
			err = gs.handleGuardianSet(ctx, resp.GuardianSet.Index, resp.GuardianSet.Addresses)
			if err != nil {
				gs.logger.Error("failed to handle guardian set", zap.Error(err))
			}

		case <-ctx.Done():
			return
		}
	}
}

func (gs *GuardianSets) handleGuardianSet(ctx context.Context, index uint32, addresses []string) error {
	if index < uint32(gs.currentGuardianSetIndex) {
		return fmt.Errorf("invalid guardian set index: %v, current guardian set index: %v", index, gs.currentGuardianSetIndex)
	}
	if index == uint32(gs.currentGuardianSetIndex) {
		gs.logger.Debug("guardian set not changed", zap.Int("index", gs.currentGuardianSetIndex))
		return nil
	}
	guardianSetAddresses := make([]eth_common.Address, len(addresses))
	for i, address := range addresses {
		guardianSetAddresses[i] = eth_common.HexToAddress(address)
	}
	guardianSet := &common.GuardianSet{
		Keys:  guardianSetAddresses,
		Index: index,
	}

	gs.logger.Info("new guardian set", zap.Uint32("index", index), zap.Strings("addresses", addresses))
	gs.guardianSetC <- guardianSet
	if index == uint32(gs.currentGuardianSetIndex)+1 {
		gs.lock.Lock()
		gs.currentGuardianSetIndex = int(index)
		gs.guardianSetLists = append(gs.guardianSetLists, guardianSet)
		gs.lock.Unlock()
		return nil
	}

	gs.logger.Info(
		"trying to get missing guardian sets from chain",
		zap.Int("current", gs.currentGuardianSetIndex),
		zap.Uint32("latestIndex", index),
	)
	contract, err := getContract(ctx, gs.ethRpcUrl, gs.ethGovernanceAddress)
	if err != nil {
		return err
	}
	guardianSets, err := getGuardianSetsFromChain(ctx, contract, uint32(gs.currentGuardianSetIndex)+1, index-1)
	if err != nil {
		return err
	}

	guardianSets = append(guardianSets, guardianSet)
	gs.lock.Lock()
	defer gs.lock.Unlock()
	gs.currentGuardianSetIndex = int(index)
	gs.guardianSetLists = append(gs.guardianSetLists, guardianSets...)
	return nil
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

func GetGuardianSetsFromChain(ctx context.Context, ethRpcUrl string, ethGovernanceAddress eth_common.Address) ([]*common.GuardianSet, error) {
	contract, err := getContract(ctx, ethRpcUrl, ethGovernanceAddress)
	if err != nil {
		return nil, err
	}
	callOpt := &bind.CallOpts{Context: ctx}
	currentIndex, err := contract.GetCurrentGuardianSetIndex(callOpt)
	if err != nil {
		return nil, err
	}
	return getGuardianSetsFromChain(ctx, contract, 0, currentIndex)
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

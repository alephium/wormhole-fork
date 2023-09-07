package ethereum

import (
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/ethereum/abi"
	"github.com/alephium/wormhole-fork/node/pkg/supervisor"
	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
	"github.com/stretchr/testify/assert"
	"go.uber.org/zap"
)

type DummyConnector struct {
	currentHeight uint64
}

func NewDummyConnector() *DummyConnector {
	return &DummyConnector{0}
}

func (c *DummyConnector) NetworkName() string {
	return "dummy-connector"
}

func (c *DummyConnector) ContractAddress() common.Address {
	return common.Address{}
}

func (c *DummyConnector) GetCurrentGuardianSetIndex(ctx context.Context) (uint32, error) {
	return 0, nil
}

func (c *DummyConnector) GetGuardianSet(ctx context.Context, index uint32) (abi.StructsGuardianSet, error) {
	return abi.StructsGuardianSet{}, nil
}

func (c *DummyConnector) WatchLogMessagePublished(ctx context.Context, sink chan<- *abi.AbiLogMessagePublished) (event.Subscription, error) {
	return nil, nil
}

func (c *DummyConnector) TransactionReceipt(ctx context.Context, txHash common.Hash) (*types.Receipt, error) {
	return nil, nil
}

func (c *DummyConnector) TimeOfBlockByHash(ctx context.Context, hash common.Hash) (uint64, error) {
	return 0, nil
}

func (c *DummyConnector) ParseLogMessagePublished(log types.Log) (*abi.AbiLogMessagePublished, error) {
	return nil, nil
}

func (c *DummyConnector) SubscribeForBlocks(ctx context.Context, sink chan<- *NewBlock) (ethereum.Subscription, error) {
	return nil, nil
}

func (c *DummyConnector) RawCallContext(ctx context.Context, result interface{}, method string, args ...interface{}) error {
	if method != "eth_getBlockByNumber" {
		return nil
	}
	c.currentHeight += 1
	heightHex := hexutil.EncodeUint64(c.currentHeight)
	hash := common.Hash{}
	rawJson := fmt.Sprintf(`{"Number": "%s", "Hash": "%s"}`, heightHex, hash.Hex())
	return json.Unmarshal([]byte(rawJson), result)
}

func TestDisableBlockPoller(t *testing.T) {
	logger, err := zap.NewDevelopment()
	assert.Nil(t, err)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	poller := &BlockPollConnector{
		Connector:    NewDummyConnector(),
		Delay:        100 * time.Millisecond,
		enabled:      &atomic.Bool{},
		useFinalized: false,
	}
	supervisor.New(ctx, logger, func(ctx context.Context) error {
		if err := supervisor.Run(ctx, "blockPoller", poller.run); err != nil {
			return err
		}
		<-ctx.Done()
		return nil
	}, supervisor.WithPropagatePanic)

	sink := make(chan *NewBlock)
	subscription, err := poller.SubscribeForBlocks(ctx, sink)
	assert.Nil(t, err)

	currentBlockHeight := uint64(0)
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case err := <-subscription.Err():
				logger.Error("subscription error", zap.Error(err))
				return
			case block := <-sink:
				atomic.StoreUint64(&currentBlockHeight, block.Number.Uint64())
			}
		}
	}()

	assertCurrentHeightEqual := func(expectedHeight uint64) {
		currentHeight := atomic.LoadUint64(&currentBlockHeight)
		assert.Equal(t, currentHeight, expectedHeight)
	}

	assertCurrentHeightNotLessThan := func(height uint64) uint64 {
		currentHeight := atomic.LoadUint64(&currentBlockHeight)
		assert.True(t, currentHeight >= height)
		return currentHeight
	}

	assertCurrentHeightEqual(0)
	time.Sleep(1 * time.Second)
	assertCurrentHeightEqual(0)

	poller.EnablePoller()
	time.Sleep(1 * time.Second)
	poller.DisablePoller()
	currentHeight := assertCurrentHeightNotLessThan(9)

	time.Sleep(1 * time.Second)
	assertCurrentHeightEqual(currentHeight)
}

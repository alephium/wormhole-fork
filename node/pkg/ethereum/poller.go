package ethereum

import (
	"context"
	"fmt"
	"math/big"
	"sync/atomic"
	"time"

	"github.com/alephium/wormhole-fork/node/pkg/supervisor"
	ethEvent "github.com/ethereum/go-ethereum/event"

	ethereum "github.com/ethereum/go-ethereum"
	ethCommon "github.com/ethereum/go-ethereum/common"
	ethHexUtils "github.com/ethereum/go-ethereum/common/hexutil"
	"go.uber.org/zap"
)

// BlockPollConnector polls for new blocks instead of subscribing when using SubscribeForBlocks
type BlockPollConnector struct {
	Connector
	Delay        time.Duration
	useFinalized bool
	enabled      *atomic.Bool
	blockFeed    ethEvent.Feed
	errFeed      ethEvent.Feed
}

func NewBlockPollConnector(ctx context.Context, baseConnector Connector, delay time.Duration, useFinalized bool) (*BlockPollConnector, error) {
	connector := &BlockPollConnector{
		Connector:    baseConnector,
		Delay:        delay,
		enabled:      &atomic.Bool{},
		useFinalized: useFinalized,
	}
	err := supervisor.Run(ctx, "blockPoller", connector.run)
	if err != nil {
		return nil, err
	}
	return connector, nil
}

func (b *BlockPollConnector) DisablePoller() {
	b.enabled.Store(false)
}

func (b *BlockPollConnector) EnablePoller() {
	b.enabled.Store(true)
}

func (b *BlockPollConnector) run(ctx context.Context) error {
	logger := supervisor.Logger(ctx).With(zap.String("eth_network", b.Connector.NetworkName()))

	// last finalized block
	lastBlock, err := b.getBlock(ctx, logger, nil, false)
	if err != nil {
		return err
	}

	timer := time.NewTimer(time.Millisecond) // Start immediately.
	supervisor.Signal(ctx, supervisor.SignalHealthy)

	for {
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
			enabled := b.enabled.Load()
			if !enabled {
				timer.Reset(b.Delay)
				continue
			}
			for count := 0; count < 3; count++ {
				lastBlock, err = b.pollBlocks(ctx, logger, lastBlock, false)
				if err == nil {
					break
				}
				logger.Error("polling of block encountered an error", zap.Error(err))

				// Wait an interval before trying again. We stay in this loop so that we
				// try up to three times before causing the watcher to restart.
				time.Sleep(b.Delay)
			}

			if err != nil {
				b.errFeed.Send(fmt.Sprint("polling encountered an error: ", err))
			}
			timer.Reset(b.Delay)
		}
	}
}

func (b *BlockPollConnector) pollBlocks(ctx context.Context, logger *zap.Logger, lastBlock *NewBlock, safe bool) (*NewBlock, error) {
	// Some of the testnet providers (like the one we are using for Arbitrum) limit how many transactions we can do. When that happens, the call hangs.
	// Use a timeout so that the call will fail and the runable will get restarted. This should not happen in mainnet, but if it does, we will need to
	// investigate why the runable is dying and fix the underlying problem.

	timeout, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	// Fetch the latest block on the chain
	// We could do this on every iteration such that if a new block is created while this function is being executed,
	// it would automatically fetch new blocks but in order to reduce API load this will be done on the next iteration.
	latestBlock, err := b.getBlock(timeout, logger, nil, safe)
	if err != nil {
		logger.Error("failed to look up latest block",
			zap.Uint64("lastSeenBlock", lastBlock.Number.Uint64()), zap.Error(err))
		return lastBlock, fmt.Errorf("failed to look up latest block: %w", err)
	}
	if lastBlock.Number.Cmp(latestBlock.Number) >= 0 {
		// We have to wait for a new block to become available
		return lastBlock, nil
	}
	logger.Debug("latest block height", zap.String("height", latestBlock.Number.String()))
	b.blockFeed.Send(latestBlock)
	return latestBlock, nil
}

func (b *BlockPollConnector) SubscribeForBlocks(ctx context.Context, sink chan<- *NewBlock) (ethereum.Subscription, error) {
	sub := NewPollSubscription()
	blockSub := b.blockFeed.Subscribe(sink)

	// The feed library does not support error forwarding, so we're emulating that using a custom subscription and
	// an error feed. The feed library can't handle interfaces which is why we post strings.
	innerErrSink := make(chan string, 10)
	innerErrSub := b.errFeed.Subscribe(innerErrSink)

	go func() {
		for {
			select {
			case <-ctx.Done():
				blockSub.Unsubscribe()
				innerErrSub.Unsubscribe()
				return
			case <-sub.quit:
				blockSub.Unsubscribe()
				innerErrSub.Unsubscribe()
				sub.unsubDone <- struct{}{}
				return
			case v := <-innerErrSink:
				sub.err <- fmt.Errorf(v)
			}
		}
	}()
	return sub, nil
}

func (b *BlockPollConnector) getBlock(ctx context.Context, logger *zap.Logger, number *big.Int, safe bool) (*NewBlock, error) {
	return getBlock(ctx, logger, b.Connector, number, b.useFinalized, safe)
}

// getBlock is a free function that can be called from other connectors to get a single block.
func getBlock(ctx context.Context, logger *zap.Logger, conn Connector, number *big.Int, useFinalized bool, safe bool) (*NewBlock, error) {
	var numStr string
	if number != nil {
		numStr = ethHexUtils.EncodeBig(number)
	} else if useFinalized {
		if safe {
			numStr = "safe"
		} else {
			numStr = "finalized"
		}
	} else {
		numStr = "latest"
	}

	type Marshaller struct {
		Number *ethHexUtils.Big
		Hash   ethCommon.Hash `json:"hash"`

		// L1BlockNumber is the L1 block number in which an Arbitrum batch containing this block was submitted.
		// This field is only populated when connecting to Arbitrum.
		L1BlockNumber *ethHexUtils.Big
	}

	var m Marshaller
	err := conn.RawCallContext(ctx, &m, "eth_getBlockByNumber", numStr, false)
	if err != nil {
		logger.Error("failed to get block",
			zap.String("requested_block", numStr), zap.Error(err))
		return nil, err
	}
	if m.Number == nil {
		logger.Error("failed to unmarshal block",
			zap.String("requested_block", numStr),
		)
		return nil, fmt.Errorf("failed to unmarshal block: Number is nil")
	}
	n := big.Int(*m.Number)

	var l1bn *big.Int
	if m.L1BlockNumber != nil {
		bn := big.Int(*m.L1BlockNumber)
		l1bn = &bn
	}

	return &NewBlock{
		Number:        &n,
		Hash:          m.Hash,
		L1BlockNumber: l1bn,
		Safe:          safe,
	}, nil
}

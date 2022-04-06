package alephium

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/readiness"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"go.uber.org/zap"
)

const MaxForkHeight = uint32(100)

type Watcher struct {
	url    string
	apiKey string

	governanceContract            string
	tokenBridgeContract           string
	tokenWrapperFactoryContract   string
	undoneSequenceEmitterContract string
	chainIndex                    *ChainIndex
	initHeight                    uint32

	readiness readiness.Component

	msgChan  chan *common.MessagePublication
	setChan  chan *common.GuardianSet
	obsvReqC chan *gossipv1.ObservationRequest

	tokenBridgeForChainCache     sync.Map
	remoteTokenWrapperCache      sync.Map
	localTokenWrapperCache       sync.Map
	tokenBridgeForChainInfoCache sync.Map

	minConfirmations uint8
	currentHeight    uint32

	db *db
}

type UnconfirmedEvent struct {
	blockHeader   *BlockHeader
	event         *Event
	eventIndex    uint64
	confirmations uint8
}

type ConfirmedEvents struct {
	events          []*UnconfirmedEvent
	contractAddress string
}

func NewAlephiumWatcher(
	url string,
	apiKey string,
	fromGroup uint8,
	toGroup uint8,
	contracts []string,
	initHeight uint32,
	readiness readiness.Component,
	messageEvents chan *common.MessagePublication,
	setEvents chan *common.GuardianSet,
	minConfirmations uint64,
	obsvReqC chan *gossipv1.ObservationRequest,
	dbPath string,
) (*Watcher, error) {
	if len(contracts) != 3 {
		return nil, fmt.Errorf("invalid contract ids")
	}
	db, err := open(dbPath)
	if err != nil {
		return nil, err
	}

	return &Watcher{
		url:                           url,
		apiKey:                        apiKey,
		governanceContract:            contracts[0],
		tokenBridgeContract:           contracts[1],
		tokenWrapperFactoryContract:   contracts[2],
		undoneSequenceEmitterContract: contracts[3],

		initHeight: initHeight,
		chainIndex: &ChainIndex{
			FromGroup: fromGroup,
			ToGroup:   toGroup,
		},

		readiness: readiness,
		msgChan:   messageEvents,
		setChan:   setEvents,
		obsvReqC:  obsvReqC,

		tokenBridgeForChainCache:     sync.Map{},
		remoteTokenWrapperCache:      sync.Map{},
		localTokenWrapperCache:       sync.Map{},
		tokenBridgeForChainInfoCache: sync.Map{},

		minConfirmations: uint8(minConfirmations),
		db:               db,
	}, nil
}

func (w *Watcher) ContractServer(logger *zap.Logger, listenAddr string) (supervisor.Runnable, error) {
	return contractServiceRunnable(w.db, listenAddr, logger)
}

func (w *Watcher) Run(ctx context.Context) error {
	p2p.DefaultRegistry.SetNetworkStats(vaa.ChainIDAlephium, &gossipv1.Heartbeat_Network{
		ContractAddress: w.governanceContract,
	})

	logger := supervisor.Logger(ctx)
	client := NewClient(w.url, w.apiKey, 10)
	nodeInfo, err := client.GetNodeInfo(ctx)
	if err != nil {
		logger.Error("failed to get node info", zap.Error(err))
		return err
	}
	logger.Info("alephium watcher started", zap.String("url", w.url), zap.String("version", nodeInfo.BuildInfo.ReleaseVersion))

	nextTokenBridgeEventIndex, err := w.fetchTokenBridgeForChainAddresses(ctx, logger, client)
	if err != nil {
		logger.Error("failed to fetch token bridge for chain addresses", zap.Error(err))
		return err
	}

	nextTokenWrapperFactoryIndex, err := w.fetchTokenWrapperAddresses(ctx, logger, client)
	if err != nil {
		logger.Error("failed to fetch token wrapper addresses", zap.Error(err))
		return err
	}

	nextUndoneSequenceEventIndex, err := w.fetchUndoneSequences(ctx, logger, client)
	if err != nil {
		logger.Error("failed to fetch undone sequences", zap.Error(err))
		return err
	}

	readiness.SetReady(w.readiness)
	errC := make(chan error)

	go w.handleObsvRequest(ctx, logger, client)
	go w.fetchHeight(ctx, logger, client, errC)
	go w.handleTokenBridgeEvents(ctx, logger, client, *nextTokenBridgeEventIndex, errC)
	go w.handleTokenWrapperFactoryEvents(ctx, logger, client, *nextTokenWrapperFactoryIndex, errC)
	go w.handleGovernanceEvents(ctx, logger, client, errC)
	go w.handleUndoneSequenceEvents(ctx, logger, client, *nextUndoneSequenceEventIndex, errC)

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errC:
		return err
	}
}

func (w *Watcher) fetchHeight(ctx context.Context, logger *zap.Logger, client *Client, errC chan<- error) {
	t := time.NewTicker(10 * time.Second)
	defer t.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			height, err := client.GetCurrentHeight(ctx, w.chainIndex)
			if err != nil {
				logger.Error("failed to get current height", zap.Error(err))
				errC <- err
				return
			}

			atomic.StoreUint32(&w.currentHeight, height)
		}
	}
}

func (w *Watcher) toUnconfirmedEvent(ctx context.Context, client *Client, event *Event) (*UnconfirmedEvent, error) {
	// TODO: cache
	header, err := client.GetBlockHeader(ctx, event.BlockHash)
	if err != nil {
		return nil, err
	}

	if event.ContractAddress != w.governanceContract {
		return &UnconfirmedEvent{
			blockHeader:   header,
			event:         event,
			confirmations: w.minConfirmations,
		}, nil
	}

	confirmations, err := event.getConsistencyLevel(w.minConfirmations)
	return &UnconfirmedEvent{
		blockHeader:   header,
		event:         event,
		confirmations: *confirmations,
	}, err
}

func (w *Watcher) toUnconfirmedEvents(ctx context.Context, client *Client, events []*Event) ([]*UnconfirmedEvent, error) {
	unconfirmedEvents := make([]*UnconfirmedEvent, len(events))
	for i, event := range events {
		unconfirmed, err := w.toUnconfirmedEvent(ctx, client, event)
		if err != nil {
			return nil, err
		}
		unconfirmedEvents[i] = unconfirmed
	}
	return unconfirmedEvents, nil
}

func (w *Watcher) updateTokenBridgeForChain(ctx context.Context, logger *zap.Logger, client *Client, confirmed *ConfirmedEvents) error {
	if len(confirmed.events) == 0 {
		return nil
	}

	maxIndex := uint64(0)
	batch := newBatch()
	for _, event := range confirmed.events {
		if event.eventIndex > maxIndex {
			maxIndex = event.eventIndex
		}

		assume(len(event.event.Fields) == 1)
		address := event.event.Fields[0].ToAddress()
		info, err := client.GetTokenBridgeForChainInfo(ctx, address, w.chainIndex.FromGroup)
		if err != nil {
			logger.Error("failed to get token bridge for chain info", zap.Error(err))
			return err
		}
		w.tokenBridgeForChainCache.Store(info.remoteChainId, &info.contractId)
		batch.writeTokenBridgeForChain(info.remoteChainId, info.address)
	}
	batch.updateLastTokenBridgeEventIndex(maxIndex)
	return w.db.writeBatch(batch)
}

func (w *Watcher) handleTokenBridgeEvents(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	fromIndex uint64,
	errC chan<- error,
) {
	handler := func(confirmed *ConfirmedEvents) error {
		return w.updateTokenBridgeForChain(ctx, logger, client, confirmed)
	}

	w.subscribe(ctx, logger, client, w.tokenBridgeContract, fromIndex, w.toUnconfirmedEvent, handler, errC)
}

func (w *Watcher) handleTokenWrapperFactoryEvents(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	nextIndex uint64,
	errC chan<- error,
) {
	handler := func(confirmed *ConfirmedEvents) error {
		if len(confirmed.events) == 0 {
			return nil
		}
		return w.validateTokenWrapperEvents(ctx, logger, client, confirmed)
	}

	w.subscribe(ctx, logger, client, w.tokenWrapperFactoryContract, nextIndex, w.toUnconfirmedEvent, handler, errC)
}

func (w *Watcher) handleGovernanceEvents(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	errC chan<- error,
) error {
	count, err := client.GetContractEventsCount(ctx, w.governanceContract)
	if err != nil {
		logger.Error("failed to get governance contract count", zap.Error(err))
		errC <- err
		return err
	}

	handler := func(confirmed *ConfirmedEvents) error {
		return w.validateGovernanceEvents(logger, confirmed)
	}

	w.subscribe(ctx, logger, client, w.governanceContract, *count, w.toUnconfirmedEvent, handler, errC)
	return nil
}

func (w *Watcher) handleUndoneSequenceEvents(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	nextIndex uint64,
	errC chan<- error,
) {
	handler := func(confirmed *ConfirmedEvents) error {
		if len(confirmed.events) == 0 {
			return nil
		}
		return w.validateUndoneSequenceEvents(ctx, logger, client, confirmed)
	}

	w.subscribe(ctx, logger, client, w.undoneSequenceEmitterContract, nextIndex, w.toUnconfirmedEvent, handler, errC)
}

func (w *Watcher) subscribe(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	contractAddress string,
	fromIndex uint64,
	toUnconfirmed func(context.Context, *Client, *Event) (*UnconfirmedEvent, error),
	handler func(*ConfirmedEvents) error,
	errC chan<- error,
) {
	unconfirmedEvents := map[uint64]*UnconfirmedEvent{}
	nextIndex := fromIndex
	lastHeight := atomic.LoadUint32(&w.currentHeight)

	eventTick := time.NewTicker(30 * time.Second)
	defer eventTick.Stop()

	process := func() error {
		height := atomic.LoadUint32(&w.currentHeight)
		if height <= lastHeight {
			return nil
		}

		confirmed := make([]*UnconfirmedEvent, 0)
		for eventIndex, unconfirmed := range unconfirmedEvents {
			if unconfirmed.blockHeader.Height+uint32(unconfirmed.confirmations) > height {
				continue
			}

			isCanonical, err := client.IsBlockInMainChain(ctx, unconfirmed.event.BlockHash)
			if err != nil {
				logger.Error("failed to check mainchain block", zap.Error(err))
				return err
			}

			if !isCanonical {
				// it's safe to update map in range loop
				delete(unconfirmedEvents, eventIndex)
				continue
			}

			confirmed = append(confirmed, unconfirmed)
			delete(unconfirmedEvents, eventIndex)
		}

		confirmedEvents := &ConfirmedEvents{
			events:          confirmed,
			contractAddress: contractAddress,
		}
		if err := handler(confirmedEvents); err != nil {
			logger.Error("failed to handle confirmed events", zap.Error(err), zap.String("contractAddress", contractAddress))
			return err
		}
		return nil
	}

	for {
		select {
		case <-ctx.Done():
			return

		case <-eventTick.C:
			count, err := client.GetContractEventsCount(ctx, contractAddress)
			if err != nil {
				logger.Error("failed to get contract event count", zap.String("contractAddress", contractAddress), zap.Error(err))
				errC <- err
				return
			}

			if *count <= nextIndex {
				if err := process(); err != nil {
					errC <- err
					return
				}
				continue
			}

			to := (*count - 1)
			events, err := client.GetContractEventsByIndex(ctx, contractAddress, nextIndex, to)
			if err != nil {
				logger.Error("failed to get contract events", zap.Uint64("from", nextIndex), zap.Uint64("to", to), zap.Error(err))
				errC <- err
				return
			}

			assume(len(events.Events) == int(to-nextIndex+1))
			for i, event := range events.Events {
				unconfirmed, err := toUnconfirmed(ctx, client, event)
				if err != nil {
					logger.Error("failed to convert to unconfirmed event", zap.Error(err))
					errC <- err
					return
				}
				unconfirmed.eventIndex = nextIndex + uint64(i)
				unconfirmedEvents[unconfirmed.eventIndex] = unconfirmed
			}

			nextIndex = *count
			if err := process(); err != nil {
				errC <- err
				return
			}
		}
	}
}

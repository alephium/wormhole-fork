package alephium

import (
	"context"
	"fmt"
	"sort"
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

var supportedChainIds = []vaa.ChainID{vaa.ChainIDEthereum}

type Watcher struct {
	url    string
	apiKey string

	governanceContractAddress string
	eventEmitterId            Byte32
	tokenBridgeContractId     Byte32
	chainIndex                *ChainIndex

	readiness readiness.Component

	msgChan  chan *common.MessagePublication
	obsvReqC chan *gossipv1.ObservationRequest

	minConfirmations uint8
	currentHeight    uint32

	contractIdToChainId map[Byte32]vaa.ChainID
	chainIdToContractId map[vaa.ChainID]Byte32

	client *Client
	db     *Database
}

type UnconfirmedEvent struct {
	blockHeader   *BlockHeader
	event         Event
	confirmations uint8
}

type UnconfirmedEvents struct {
	eventIndex uint64
	events     []*UnconfirmedEvent
}

type ConfirmedEvents struct {
	events []*UnconfirmedEvents
}

func NewAlephiumWatcher(
	url string,
	apiKey string,
	fromGroup uint8,
	toGroup uint8,
	contracts []string,
	readiness readiness.Component,
	messageEvents chan *common.MessagePublication,
	minConfirmations uint64,
	obsvReqC chan *gossipv1.ObservationRequest,
	db *Database,
) (*Watcher, error) {
	if len(contracts) != 3 {
		return nil, fmt.Errorf("invalid contract ids")
	}

	watcher := &Watcher{
		url:                       url,
		apiKey:                    apiKey,
		eventEmitterId:            toContractId(contracts[0]),
		governanceContractAddress: contracts[1],
		tokenBridgeContractId:     toContractId(contracts[2]),

		chainIndex: &ChainIndex{
			FromGroup: fromGroup,
			ToGroup:   toGroup,
		},

		readiness: readiness,
		msgChan:   messageEvents,
		obsvReqC:  obsvReqC,

		minConfirmations: uint8(minConfirmations),

		contractIdToChainId: make(map[Byte32]vaa.ChainID),
		chainIdToContractId: make(map[vaa.ChainID]Byte32),

		client: NewClient(url, apiKey, 10),
		db:     db,
	}
	watcher.initSupportedChains()
	return watcher, nil
}

func (w *Watcher) initSupportedChains() {
	for _, chainId := range supportedChainIds {
		preImage := append(Uint16ToBytes(uint16(chainId))[:], w.tokenBridgeContractId[:]...)
		tokenBridgeForChainId := Byte32(blake2bDoubleHash(preImage))
		w.chainIdToContractId[chainId] = tokenBridgeForChainId
		w.contractIdToChainId[tokenBridgeForChainId] = chainId
	}
}

func (w *Watcher) Run(ctx context.Context) error {
	p2p.DefaultRegistry.SetNetworkStats(vaa.ChainIDAlephium, &gossipv1.Heartbeat_Network{
		ContractAddress: w.governanceContractAddress,
	})

	logger := supervisor.Logger(ctx)
	nodeInfo, err := w.client.GetNodeInfo(ctx)
	if err != nil {
		logger.Error("failed to get node info", zap.Error(err))
		return err
	}
	logger.Info("alephium watcher started", zap.String("url", w.url), zap.String("version", nodeInfo.BuildInfo.ReleaseVersion))

	eventEmitterAddress := ToContractAddress(w.eventEmitterId)
	nextEventIndex, err := w.fetchEvents(ctx, logger, w.client, eventEmitterAddress)
	if err != nil {
		logger.Error("failed to fetch events when recovery", zap.Error(err))
		return err
	}

	readiness.SetReady(w.readiness)
	errC := make(chan error)

	go w.handleObsvRequest(ctx, logger, w.client)
	go w.fetchHeight(ctx, logger, w.client, errC)
	go w.subscribe(ctx, logger, w.client, eventEmitterAddress, *nextEventIndex, w.toUnconfirmedEvent, w.handleEvents, errC)

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
			logger.Info(
				"alephium block height",
				zap.Uint32("height", height),
				zap.Uint8("fromGroup", w.chainIndex.FromGroup),
				zap.Uint8("toGroup", w.chainIndex.ToGroup),
			)

			atomic.StoreUint32(&w.currentHeight, height)
		}
	}
}

func (w *Watcher) handleEvents(logger *zap.Logger, confirmed *ConfirmedEvents) error {
	if len(confirmed.events) == 0 {
		return nil
	}

	sort.Slice(confirmed.events, func(i, j int) bool {
		return confirmed.events[i].eventIndex < confirmed.events[j].eventIndex
	})

	// TODO: batch write to db
	for _, events := range confirmed.events {
		for _, e := range events.events {
			logger.Debug("new confirmed event received", zap.String("event", e.event.ToString()))

			var skipIfError bool
			var validateErr error
			switch e.event.eventIndex() {
			case WormholeMessageEventIndex:
				event, err := e.event.ToWormholeMessage()
				if err != nil {
					logger.Error("ignore invalid wormhole message", zap.Error(err), zap.String("event", e.event.ToString()))
					continue
				}
				skipIfError, validateErr = w.validateGovernanceMessages(event)
				if validateErr == nil {
					w.msgChan <- event.toMessagePublication(e.blockHeader)
				}

			case UndoneSequencesRemovedEventIndex:
				event, err := e.event.fields().toUndoneSequencesRemoved()
				if err != nil {
					logger.Error("ignore invalid undone sequences removed event", zap.Error(err), zap.String("event", e.event.ToString()))
					continue
				}
				skipIfError, validateErr = w.validateUndoneSequencesRemovedEvents(event, w.getRemoteChainId)

			case UndoneSequenceCompletedEventIndex:
				event, err := e.event.fields().toUndoneSequenceCompleted()
				if err != nil {
					logger.Error("ignore invalid undone sequence completed event", zap.Error(err), zap.String("event", e.event.ToString()))
					continue
				}
				skipIfError, validateErr = w.validateUndoneSequenceCompletedEvents(event)

			default:
				return fmt.Errorf("unknown event index %v", e.event.eventIndex())
			}

			if validateErr != nil && skipIfError {
				logger.Error("ignore invalid event", zap.Error(validateErr))
				continue
			}
			if validateErr != nil && !skipIfError {
				logger.Error("failed to validate event", zap.Error(validateErr))
				return validateErr
			}
		}

		if err := w.db.updateLastEventIndex(events.eventIndex); err != nil {
			logger.Error("failed to save last event index", zap.Error(err))
			return err
		}
	}
	return nil
}

func (w *Watcher) toUnconfirmedEvent(ctx context.Context, client *Client, event *ContractEvent) (*UnconfirmedEvent, error) {
	// TODO: LRU cache
	header, err := client.GetBlockHeader(ctx, event.BlockHash)
	if err != nil {
		return nil, err
	}

	if event.EventIndex != WormholeMessageEventIndex {
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

func (w *Watcher) subscribe(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	contractAddress string,
	fromIndex uint64,
	toUnconfirmed func(context.Context, *Client, *ContractEvent) (*UnconfirmedEvent, error),
	handler func(*zap.Logger, *ConfirmedEvents) error,
	errC chan<- error,
) {
	w.subscribe_(ctx, logger, client, contractAddress, fromIndex, toUnconfirmed, handler, 10*time.Second, errC)
}

func (w *Watcher) subscribe_(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	contractAddress string,
	fromIndex uint64,
	toUnconfirmed func(context.Context, *Client, *ContractEvent) (*UnconfirmedEvent, error),
	handler func(*zap.Logger, *ConfirmedEvents) error,
	tickDuration time.Duration,
	errC chan<- error,
) {
	pendingEvents := map[string]*UnconfirmedEvents{}
	startIndex := fromIndex
	lastHeight := atomic.LoadUint32(&w.currentHeight)

	eventTick := time.NewTicker(tickDuration)
	defer eventTick.Stop()

	process := func() error {
		height := atomic.LoadUint32(&w.currentHeight)
		if height <= lastHeight {
			return nil
		}

		confirmedEvents := make([]*UnconfirmedEvents, 0)
		for blockHash, unconfirmedEvents := range pendingEvents {
			isCanonical, err := client.IsBlockInMainChain(ctx, blockHash)
			if err != nil {
				logger.Error("failed to check mainchain block", zap.Error(err))
				return err
			}
			if !isCanonical {
				// it's safe to update map in range loop
				delete(pendingEvents, blockHash)
				continue
			}

			confirmed := make([]*UnconfirmedEvent, 0)
			remain := make([]*UnconfirmedEvent, 0)
			for _, event := range unconfirmedEvents.events {
				if event.blockHeader.Height+uint32(event.confirmations) > height {
					remain = append(confirmed, event)
					continue
				}
				confirmed = append(confirmed, event)
			}

			if len(confirmed) == 0 {
				continue
			}

			if len(remain) == 0 {
				delete(pendingEvents, blockHash)
			} else {
				pendingEvents[blockHash] = &UnconfirmedEvents{
					events:     remain,
					eventIndex: unconfirmedEvents.eventIndex,
				}
			}

			confirmedEvents = append(confirmedEvents, &UnconfirmedEvents{
				events:     confirmed,
				eventIndex: unconfirmedEvents.eventIndex,
			})
		}
		if len(confirmedEvents) == 0 {
			return nil
		}
		confirmed := &ConfirmedEvents{confirmedEvents}
		if err := handler(logger, confirmed); err != nil {
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
			logger.Info("alephium contract event count", zap.Uint64("count", *count), zap.Uint64("startIndex", startIndex))

			if *count == startIndex {
				if err := process(); err != nil {
					errC <- err
					return
				}
				continue
			}

			for {
				events, err := client.GetContractEvents(ctx, contractAddress, startIndex, w.chainIndex.FromGroup)
				if err != nil {
					logger.Error("failed to get contract events", zap.Uint64("from", startIndex), zap.Error(err))
					errC <- err
					return
				}

				eventIndex := startIndex
				for _, event := range events.Events {
					unconfirmed, err := toUnconfirmed(ctx, client, event)
					if err != nil {
						logger.Error("failed to convert to unconfirmed event", zap.Error(err))
						errC <- err
						return
					}
					blockHash := unconfirmed.event.blockHash()
					if lst, ok := pendingEvents[blockHash]; ok {
						lst.events = append(lst.events, unconfirmed)
					} else {
						pendingEvents[blockHash] = &UnconfirmedEvents{
							events:     []*UnconfirmedEvent{unconfirmed},
							eventIndex: eventIndex,
						}
						eventIndex += 1
					}
				}

				startIndex = events.NextStart
				if events.NextStart == *count {
					break
				}
			}

			if err := process(); err != nil {
				errC <- err
				return
			}
		}
	}
}

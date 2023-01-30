package alephium

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	sdk "github.com/alephium/go-sdk"
	"github.com/alephium/wormhole-fork/node/pkg/common"
	"github.com/alephium/wormhole-fork/node/pkg/p2p"
	gossipv1 "github.com/alephium/wormhole-fork/node/pkg/proto/gossip/v1"
	"github.com/alephium/wormhole-fork/node/pkg/readiness"
	"github.com/alephium/wormhole-fork/node/pkg/supervisor"
	"github.com/alephium/wormhole-fork/node/pkg/vaa"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
	"go.uber.org/zap"
)

var (
	alphConnectionErrors = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "wormhole_alph_connection_errors_total",
			Help: "Total number of Alephium connection errors",
		}, []string{"operation"})
	alphMessagesObserved = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "wormhole_alph_messages_observed_total",
			Help: "Total number of Alephium messages observed (pre-confirmation)",
		})
	alphMessagesOrphaned = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "wormhole_alph_messages_orphaned_total",
			Help: "Total number of Alephium messages dropped (orphaned)",
		})
	alphMessagesConfirmed = promauto.NewCounter(
		prometheus.CounterOpts{
			Name: "wormhole_alph_messages_confirmed_total",
			Help: "Total number of Alephium messages verified (post-confirmation)",
		})
	currentAlphHeight = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "wormhole_alph_current_height",
			Help: "Current Alephium block height",
		})
	queryLatency = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name: "wormhole_alph_query_latency",
			Help: "Latency histogram for Alephium calls",
		}, []string{"operation"})
)

type Watcher struct {
	url    string
	apiKey string

	governanceContractAddress string
	tokenBridgeContractId     Byte32
	chainIndex                *ChainIndex

	readiness readiness.Component

	msgChan  chan *common.MessagePublication
	obsvReqC chan *gossipv1.ObservationRequest

	minConfirmations uint8
	fetchPeriod      uint8
	currentHeight    int32

	client *Client
}

type UnconfirmedEvent struct {
	*sdk.ContractEvent
	msg *WormholeMessage
}

type UnconfirmedEventsPerBlock struct {
	header *sdk.BlockHeaderEntry
	events []*UnconfirmedEvent
}

type ConfirmedEvent struct {
	header *sdk.BlockHeaderEntry
	event  *UnconfirmedEvent
}

func NewAlephiumWatcher(
	url string,
	apiKey string,
	fromGroup uint8,
	toGroup uint8,
	contracts []string,
	readiness readiness.Component,
	messageEvents chan *common.MessagePublication,
	minConfirmations uint8,
	fetchPeriod uint8,
	obsvReqC chan *gossipv1.ObservationRequest,
) (*Watcher, error) {
	if len(contracts) != 2 {
		return nil, fmt.Errorf("invalid contract ids")
	}
	governanceContractAddress, err := ToContractAddress(contracts[0])
	if err != nil {
		return nil, fmt.Errorf("invalid governance contract id")
	}
	tokenBridgeContractId, err := HexToByte32(contracts[1])
	if err != nil {
		return nil, fmt.Errorf("invalid token bridge contract id")
	}

	watcher := &Watcher{
		url:                       url,
		apiKey:                    apiKey,
		governanceContractAddress: *governanceContractAddress,
		tokenBridgeContractId:     tokenBridgeContractId,

		chainIndex: &ChainIndex{
			FromGroup: int32(fromGroup),
			ToGroup:   int32(toGroup),
		},

		readiness: readiness,
		msgChan:   messageEvents,
		obsvReqC:  obsvReqC,

		minConfirmations: minConfirmations,
		fetchPeriod:      fetchPeriod,

		client: NewClient(url, apiKey, 10),
	}
	return watcher, nil
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

	isSynced, err := w.client.IsCliqueSynced(ctx)
	if err != nil {
		logger.Error("failed to get self cliqued synced", zap.Error(err))
		return err
	}
	if !*isSynced {
		return fmt.Errorf("clique not synced")
	}

	logger.Info("alephium watcher started", zap.String("url", w.url), zap.String("version", nodeInfo.BuildInfo.ReleaseVersion))

	readiness.SetReady(w.readiness)
	errC := make(chan error)
	eventsC := make(chan []*UnconfirmedEvent)
	heightC := make(chan int32)

	go w.fetchEvents(ctx, logger, w.client, errC, eventsC)
	go w.handleObsvRequest(ctx, logger, w.client)
	go w.fetchHeight(ctx, logger, w.client, errC, heightC)
	go w.handleEvents(ctx, logger, w.client, errC, eventsC, heightC)

	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-errC:
		return err
	}
}

func (w *Watcher) fetchEvents(ctx context.Context, logger *zap.Logger, client *Client, errC chan<- error, eventsC chan<- []*UnconfirmedEvent) {
	contractAddress := w.governanceContractAddress
	currentEventCount, err := client.GetContractEventsCount(ctx, contractAddress)
	if err != nil {
		logger.Error("failed to get contract event count", zap.String("contractAddress", contractAddress), zap.Error(err))
		errC <- err
		return
	}

	fromIndex := *currentEventCount
	eventTick := time.NewTicker(time.Duration(w.fetchPeriod) * time.Second)
	defer eventTick.Stop()

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
			logger.Info("alephium contract event count", zap.Int32("count", *count), zap.Int32("fromIndex", fromIndex))

			if *count == fromIndex {
				continue
			}

			unconfirmedEvents := make([]*UnconfirmedEvent, 0)
			for {
				events, err := client.GetContractEvents(ctx, contractAddress, fromIndex, w.chainIndex.FromGroup)
				if err != nil {
					logger.Error("failed to get contract events", zap.Int32("fromIndex", fromIndex), zap.Error(err))
					errC <- err
					return
				}

				for _, event := range events.Events {
					unconfirmed, err := w.toUnconfirmedEvent(&event)
					if err != nil {
						logger.Error("failed to convert to unconfirmed event", zap.Error(err))
						errC <- err
						return
					}
					unconfirmedEvents = append(unconfirmedEvents, unconfirmed)
				}

				fromIndex = events.NextStart
				if events.NextStart == *count {
					break
				}
			}

			alphMessagesObserved.Add(float64(len(unconfirmedEvents)))
			eventsC <- unconfirmedEvents
		}
	}
}

func (w *Watcher) fetchHeight(ctx context.Context, logger *zap.Logger, client *Client, errC chan<- error, heightC chan<- int32) {
	t := time.NewTicker(time.Duration(w.fetchPeriod) * time.Second)
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
				zap.Int32("height", *height),
				zap.Int32("fromGroup", w.chainIndex.FromGroup),
				zap.Int32("toGroup", w.chainIndex.ToGroup),
			)

			previousHeight := atomic.LoadInt32(&w.currentHeight)
			if *height != previousHeight {
				currentAlphHeight.Set(float64(*height))
				atomic.StoreInt32(&w.currentHeight, *height)
				heightC <- *height
			}
		}
	}
}

func (w *Watcher) handleConfirmedEvents(logger *zap.Logger, confirmed []*ConfirmedEvent) error {
	if len(confirmed) == 0 {
		return nil
	}

	alphMessagesConfirmed.Add(float64(len(confirmed)))
	for _, e := range confirmed {
		logger.Debug("new confirmed event received", zap.String("event", marshalContractEvent(e.event.ContractEvent)))

		switch e.event.EventIndex {
		case WormholeMessageEventIndex:
			if !e.event.msg.senderId.equalWith(w.tokenBridgeContractId) {
				logger.Error("invalid sender for wormhole message", zap.String("event", marshalContractEvent(e.event.ContractEvent)))
				continue
			}
			w.msgChan <- e.event.msg.toMessagePublication(e.header)

		default:
			return fmt.Errorf("unknown event index %v", e.event.EventIndex)
		}
	}
	return nil
}

func (w *Watcher) toUnconfirmedEvent(event *sdk.ContractEvent) (*UnconfirmedEvent, error) {
	if event.EventIndex != WormholeMessageEventIndex {
		return nil, fmt.Errorf("invalid event index: %v", event.EventIndex)
	}

	msg, err := ToWormholeMessage(event.Fields, event.TxId)
	if err != nil {
		return nil, err
	}
	return &UnconfirmedEvent{event, msg}, err
}

func (w *Watcher) handleEvents(ctx context.Context, logger *zap.Logger, client *Client, errC chan<- error, eventsC <-chan []*UnconfirmedEvent, heightC <-chan int32) {
	isBlockInMainChain := func(hash string) (*bool, error) {
		return client.IsBlockInMainChain(ctx, hash)
	}
	getBlockHeader := func(hash string) (*sdk.BlockHeaderEntry, error) {
		return client.GetBlockHeader(ctx, hash)
	}

	w.handleEvents_(ctx, logger, isBlockInMainChain, getBlockHeader, w.handleConfirmedEvents, errC, eventsC, heightC)
}

func (w *Watcher) handleEvents_(
	ctx context.Context,
	logger *zap.Logger,
	isBlockInMainChain func(string) (*bool, error),
	getBlockHeader func(string) (*sdk.BlockHeaderEntry, error),
	handler func(*zap.Logger, []*ConfirmedEvent) error,
	errC chan<- error,
	eventsC <-chan []*UnconfirmedEvent,
	heightC <-chan int32,
) {
	pendingEvents := map[string]*UnconfirmedEventsPerBlock{}

	process := func(height int32) error {
		logger.Debug("processing events", zap.Int32("height", height))
		confirmedEvents := make([]*ConfirmedEvent, 0)
		for blockHash, blockEvents := range pendingEvents {
			isCanonical, err := isBlockInMainChain(blockHash)
			if err != nil {
				logger.Error("failed to check mainchain block", zap.Error(err))
				return err
			}
			if !*isCanonical {
				alphMessagesOrphaned.Add(float64(len(blockEvents.events)))
				// it's safe to update map in range loop
				delete(pendingEvents, blockHash)
				continue
			}

			if blockEvents.header == nil {
				blockHeader, err := getBlockHeader(blockHash)
				if err != nil {
					logger.Error("failed to get block header", zap.Error(err))
					return err
				}
				blockEvents.header = blockHeader
			}

			remain := make([]*UnconfirmedEvent, 0)
			for _, event := range blockEvents.events {
				eventConfirmations := maxUint8(event.msg.consistencyLevel, w.minConfirmations)
				if blockEvents.header.Height+int32(eventConfirmations) > height {
					logger.Debug(
						"event not confirmed",
						zap.String("txId", event.TxId),
						zap.Int32("blockHeight", blockEvents.header.Height),
						zap.Uint8("confirmations", eventConfirmations),
					)
					remain = append(remain, event)
					continue
				}

				logger.Debug("event confirmed", zap.String("txId", event.TxId), zap.String("blockHash", event.BlockHash))
				confirmedEvents = append(confirmedEvents, &ConfirmedEvent{
					event:  event,
					header: blockEvents.header,
				})
			}

			if len(remain) == 0 {
				delete(pendingEvents, blockHash)
			} else {
				blockEvents.events = remain
			}
		}
		if len(confirmedEvents) == 0 {
			return nil
		}
		if err := handler(logger, confirmedEvents); err != nil {
			logger.Error("failed to handle confirmed events", zap.Error(err))
			return err
		}
		return nil
	}

	for {
		select {
		case <-ctx.Done():
			return

		case events := <-eventsC:
			for _, event := range events {
				blockHash := event.BlockHash
				if lst, ok := pendingEvents[blockHash]; ok {
					lst.events = append(lst.events, event)
				} else {
					pendingEvents[blockHash] = &UnconfirmedEventsPerBlock{
						events: []*UnconfirmedEvent{event},
					}
				}
			}

		case height := <-heightC:
			if err := process(height); err != nil {
				errC <- err
				return
			}
		}
	}
}

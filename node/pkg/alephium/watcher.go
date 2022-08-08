package alephium

import (
	"context"
	"fmt"
	"sync/atomic"
	"time"

	sdk "github.com/alephium/go-sdk"
	"github.com/certusone/wormhole/node/pkg/common"
	"github.com/certusone/wormhole/node/pkg/p2p"
	gossipv1 "github.com/certusone/wormhole/node/pkg/proto/gossip/v1"
	"github.com/certusone/wormhole/node/pkg/readiness"
	"github.com/certusone/wormhole/node/pkg/supervisor"
	"github.com/certusone/wormhole/node/pkg/vaa"
	"go.uber.org/zap"
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
	currentHeight    int32

	client *Client
}

type UnconfirmedEvent struct {
	*sdk.ContractEvent
	confirmations uint8
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
	obsvReqC chan *gossipv1.ObservationRequest,
) (*Watcher, error) {
	if len(contracts) != 2 {
		return nil, fmt.Errorf("invalid contract ids")
	}

	watcher := &Watcher{
		url:                       url,
		apiKey:                    apiKey,
		governanceContractAddress: contracts[0],
		tokenBridgeContractId:     toContractId(contracts[1]),

		chainIndex: &ChainIndex{
			FromGroup: int32(fromGroup),
			ToGroup:   int32(toGroup),
		},

		readiness: readiness,
		msgChan:   messageEvents,
		obsvReqC:  obsvReqC,

		minConfirmations: minConfirmations,

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
	logger.Info("alephium watcher started", zap.String("url", w.url), zap.String("version", nodeInfo.BuildInfo.ReleaseVersion))

	readiness.SetReady(w.readiness)
	errC := make(chan error)

	go w.handleObsvRequest(ctx, logger, w.client)
	go w.fetchHeight(ctx, logger, w.client, errC)
	go w.subscribe(ctx, logger, w.client, errC)

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
				zap.Int32("height", *height),
				zap.Int32("fromGroup", w.chainIndex.FromGroup),
				zap.Int32("toGroup", w.chainIndex.ToGroup),
			)

			atomic.StoreInt32(&w.currentHeight, *height)
		}
	}
}

func (w *Watcher) handleEvents(logger *zap.Logger, confirmed []*ConfirmedEvent) error {
	if len(confirmed) == 0 {
		return nil
	}

	for _, e := range confirmed {
		logger.Debug("new confirmed event received", zap.String("event", marshalContractEvent(e.event.ContractEvent)))

		switch e.event.EventIndex {
		case WormholeMessageEventIndex:
			event, err := ToWormholeMessage(e.event.Fields, e.event.TxId)
			if err != nil {
				logger.Error("ignore invalid wormhole message", zap.Error(err), zap.String("event", marshalContractEvent(e.event.ContractEvent)))
				continue
			}
			if !event.senderId.equalWith(w.tokenBridgeContractId) {
				logger.Error("invalid sender for wormhole message", zap.String("event", marshalContractEvent(e.event.ContractEvent)))
				continue
			}
			w.msgChan <- event.toMessagePublication(e.header)

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

	field := event.Fields[len(event.Fields)-1]
	confirmations, err := getConsistencyLevel(field, w.minConfirmations)
	if err != nil {
		return nil, err
	}
	return &UnconfirmedEvent{
		event,
		*confirmations,
	}, err
}

func (w *Watcher) subscribe(ctx context.Context, logger *zap.Logger, client *Client, errC chan<- error) {
	w.subscribe_(ctx, logger, client, w.governanceContractAddress, w.toUnconfirmedEvent, w.handleEvents, 10*time.Second, errC)
}

func (w *Watcher) subscribe_(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	contractAddress string,
	toUnconfirmed func(*sdk.ContractEvent) (*UnconfirmedEvent, error),
	handler func(*zap.Logger, []*ConfirmedEvent) error,
	tickDuration time.Duration,
	errC chan<- error,
) {
	currentEventCount, err := client.GetContractEventsCount(ctx, contractAddress)
	if err != nil {
		logger.Error("failed to get contract event count", zap.String("contractAddress", contractAddress), zap.Error(err))
		errC <- err
		return
	}

	pendingEvents := map[string]*UnconfirmedEventsPerBlock{}
	lastHeight := atomic.LoadInt32(&w.currentHeight)
	fromIndex := *currentEventCount
	eventTick := time.NewTicker(tickDuration)
	defer eventTick.Stop()

	process := func() error {
		height := atomic.LoadInt32(&w.currentHeight)
		logger.Debug("processing events", zap.Int32("height", height), zap.Int32("lastHeight", lastHeight))
		if height <= lastHeight {
			return nil
		}

		lastHeight = height
		confirmedEvents := make([]*ConfirmedEvent, 0)
		for blockHash, blockEvents := range pendingEvents {
			isCanonical, err := client.IsBlockInMainChain(ctx, blockHash)
			if err != nil {
				logger.Error("failed to check mainchain block", zap.Error(err))
				return err
			}
			if !*isCanonical {
				// it's safe to update map in range loop
				delete(pendingEvents, blockHash)
				continue
			}

			if blockEvents.header == nil {
				blockHeader, err := client.GetBlockHeader(ctx, blockHash)
				if err != nil {
					logger.Error("failed to get block header", zap.Error(err))
					return err
				}
				blockEvents.header = blockHeader
			}

			remain := make([]*UnconfirmedEvent, 0)
			for _, event := range blockEvents.events {
				if blockEvents.header.Height+int32(event.confirmations) > height {
					logger.Debug(
						"event not confirmed",
						zap.String("txId", event.TxId),
						zap.Int32("blockHeight", blockEvents.header.Height),
						zap.Uint8("confirmations", event.confirmations),
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
			logger.Info("alephium contract event count", zap.Int32("count", *count), zap.Int32("fromIndex", fromIndex))

			if *count == fromIndex {
				if err := process(); err != nil {
					errC <- err
					return
				}
				continue
			}

			for {
				events, err := client.GetContractEvents(ctx, contractAddress, fromIndex, w.chainIndex.FromGroup)
				if err != nil {
					logger.Error("failed to get contract events", zap.Int32("fromIndex", fromIndex), zap.Error(err))
					errC <- err
					return
				}

				for _, event := range events.Events {
					unconfirmed, err := toUnconfirmed(&event)
					if err != nil {
						logger.Error("failed to convert to unconfirmed event", zap.Error(err))
						errC <- err
						return
					}
					blockHash := unconfirmed.BlockHash
					if lst, ok := pendingEvents[blockHash]; ok {
						lst.events = append(lst.events, unconfirmed)
					} else {
						pendingEvents[blockHash] = &UnconfirmedEventsPerBlock{
							events: []*UnconfirmedEvent{unconfirmed},
						}
					}
				}

				fromIndex = events.NextStart
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

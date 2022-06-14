package alephium

import (
	"context"

	"github.com/dgraph-io/badger/v3"
	"go.uber.org/zap"
)

func (w *Watcher) fetchEvents(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	contractAddress string,
) (*uint64, error) {
	lastEventIndexGetter := func() (*uint64, error) {
		return w.db.getLastEventIndex()
	}
	toConfirmedEvents := func(blockHeight uint32, events *ContractEvents, fromIndex uint64) (*uint64, []*UnconfirmedEvent, error) {
		return w.toConfirmedEvents(ctx, logger, client, blockHeight, events, fromIndex)
	}
	return w.fetchEvents_(ctx, logger, client, contractAddress, lastEventIndexGetter, toConfirmedEvents, w.handleEvents)
}

func (w *Watcher) fetchEvents_(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	contractAddress string,
	lastEventIndexGetter func() (*uint64, error),
	toConfirmedEvents func(uint32, *ContractEvents, uint64) (*uint64, []*UnconfirmedEvent, error),
	handler func(*zap.Logger, *ConfirmedEvents) error,
) (*uint64, error) {
	lastEventIndex, err := lastEventIndexGetter()
	if err == badger.ErrKeyNotFound {
		from := uint64(0)
		return &from, nil
	}

	if err != nil {
		logger.Error("failed to get last event index", zap.Error(err), zap.String("contractAddress", contractAddress))
		return nil, err
	}

	blockHeight, err := client.GetCurrentHeight(ctx, w.chainIndex)
	if err != nil {
		logger.Error("failed to get current block height", zap.Error(err), zap.Any("chainIndex", w.chainIndex))
		return nil, err
	}

	from := *lastEventIndex + 1
	allEvents := make([]*UnconfirmedEvent, 0)
	for {
		events, err := client.GetContractEvents(ctx, contractAddress, from, w.chainIndex.FromGroup)
		if err != nil {
			logger.Error("failed to get events", zap.Error(err), zap.Uint64("from", from), zap.String("contractAddress", contractAddress))
			return nil, err
		}

		if len(events.Events) == 0 {
			break
		}

		eventIndex, confirmedEvents, err := toConfirmedEvents(blockHeight, events, from)
		if err != nil {
			return nil, err
		}
		allEvents = append(allEvents, confirmedEvents...)
		if *eventIndex != events.NextStart {
			break
		}
		from = *eventIndex
	}
	confirmed := &ConfirmedEvents{[]*UnconfirmedEvents{
		{
			eventIndex: 0,
			events:     allEvents,
		},
	}}
	if err := handler(logger, confirmed); err != nil {
		return nil, err
	}
	logger.Info("alph watcher recovery completed, fetch events from", zap.Uint64("from", from))
	return &from, nil
}

func (w *Watcher) toConfirmedEvents(
	ctx context.Context,
	logger *zap.Logger,
	client *Client,
	blockHeight uint32,
	events *ContractEvents,
	fromIndex uint64,
) (*uint64, []*UnconfirmedEvent, error) {
	confirmedEvents := make([]*UnconfirmedEvent, 0)
	var blockHeader *BlockHeader
	var isCanonical bool
	var err error
	eventIndex := fromIndex
	for _, event := range events.Events {
		if blockHeader == nil || event.BlockHash != blockHeader.Hash {
			blockHeader, err = client.GetBlockHeader(ctx, event.BlockHash)
			if err != nil {
				logger.Error("failed to get block header", zap.Error(err), zap.String("hash", event.BlockHash))
				return nil, nil, err
			}

			if blockHeader.Height+uint32(w.minConfirmations) > blockHeight {
				break
			}
			eventIndex += 1

			isCanonical, err = client.IsBlockInMainChain(ctx, event.BlockHash)
			if err != nil {
				logger.Error("failed to check main chain block", zap.Error(err), zap.String("hash", event.BlockHash))
				return nil, nil, err
			}
		}

		if event.EventIndex == WormholeMessageEventIndex || !isCanonical {
			continue
		}

		confirmedEvents = append(confirmedEvents, &UnconfirmedEvent{
			event:         event,
			confirmations: w.minConfirmations,
		})
	}
	return &eventIndex, confirmedEvents, nil
}

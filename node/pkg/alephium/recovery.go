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
	lastEventIndexGetter func() (*uint64, error),
	contractAddress string,
	handler func(*ConfirmedEvents) error,
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

	count, err := client.GetContractEventsCount(ctx, contractAddress)
	if err != nil {
		logger.Error("failed to get event count", zap.Error(err), zap.String("contractAddress", contractAddress))
		return nil, err
	}

	from := *lastEventIndex + 1
	to := *count - 1
	events, err := client.GetContractEventsByIndex(ctx, contractAddress, from, to)
	if err != nil {
		logger.Error("failed to get events", zap.Error(err), zap.Uint64("from", from), zap.Uint64("to", to), zap.String("contractAddress", contractAddress))
		return nil, err
	}

	unconfirmed, err := w.toUnconfirmedEvents(ctx, client, events.Events)
	if err != nil {
		logger.Error("failed to fetch unconfirmed events", zap.Error(err))
		return nil, err
	}
	// TODO: wait for confirmed???
	confirmed := &ConfirmedEvents{
		events:          unconfirmed,
		contractAddress: w.tokenBridgeContract,
	}
	if err := handler(confirmed); err != nil {
		return nil, err
	}
	return count, nil
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

func (w *Watcher) fetchTokenBridgeForChainAddresses(ctx context.Context, logger *zap.Logger, client *Client) (*uint64, error) {
	handler := func(confirmed *ConfirmedEvents) error {
		return w.updateTokenBridgeForChain(ctx, logger, client, confirmed)
	}
	return w.fetchEvents(ctx, logger, client, w.db.getLastTokenBridgeEventIndex, w.tokenBridgeContract, handler)
}

func (w *Watcher) fetchTokenWrapperAddresses(ctx context.Context, logger *zap.Logger, client *Client) (*uint64, error) {
	handler := func(confirmed *ConfirmedEvents) error {
		return w.validateTokenWrapperEvents(ctx, logger, client, confirmed)
	}
	return w.fetchEvents(ctx, logger, client, w.db.getLastTokenWrapperFactoryEventIndex, w.tokenWrapperFactoryContract, handler)
}

func (w *Watcher) fetchUndoneSequences(ctx context.Context, logger *zap.Logger, client *Client) (*uint64, error) {
	handler := func(confirmed *ConfirmedEvents) error {
		return w.validateUndoneSequenceEvents(ctx, logger, client, confirmed)
	}
	return w.fetchEvents(ctx, logger, client, w.db.getLastUndoneSequenceEventIndex, w.undoneSequenceEmitterContract, handler)
}
